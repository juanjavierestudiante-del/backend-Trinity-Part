/** Diagnóstico optativo; nunca habilitar contra production. Sin hooks de negocio. */
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../src/config/prisma.js', () => ({ default: db }));
const enabled = process.env.VENTAS_POSTGRES_LATENCIA === '1';
let db: PrismaClient<Prisma.PrismaClientOptions, 'query'>;
type Event = { query: string; params: string; duration: number; at: number };
let events: Event[] = [];
let external: { model?: string; action: string; start: number; end: number }[] = [];
let measuring = false;
const emit = (kind: string, data: unknown) => console.log('[latencia]', JSON.stringify({ kind, data }));
const stats = (values: number[]) => {
  const s = [...values].sort((a,b) => a-b);
  return { min:s[0],max:s.at(-1),promedio:s.reduce((a,b)=>a+b,0)/s.length,
    mediana:(s[4]+s[5])/2,p95:s[Math.ceil(.95*s.length)-1] };
};
afterAll(async () => { await db?.$disconnect(); });

it.skipIf(!enabled)('diagnóstico de latencia real aislado', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  expect(url.hostname).toBe('ep-patient-sun-acc51t0z.sa-east-1.aws.neon.tech');
  expect(url.pathname).toBe('/fase4b_cutover_empty_20261004');
  expect(url.searchParams.get('sslmode')).toBe('require');
  db = new PrismaClient({ log: [{emit:'event',level:'query'}, {emit:'stdout',level:'error'}] });
  db.$on('query', e => { if (measuring) events.push({query:e.query,params:e.params,duration:e.duration,at:performance.now()}); });
  db.$use(async (p,next) => {
    const start=performance.now();
    try { return await next(p); }
    finally { if(measuring) external.push({model:p.model,action:p.action,start,end:performance.now()}); }
  });
  let t=performance.now(); await db.$connect(); emit('connect_ms',performance.now()-t);
  expect(await db.producto.count()).toBe(0); expect(await db.usuario.count()).toBe(0);
  const select = async (tx:Prisma.TransactionClient,inside:boolean) => {
    const start=Date.now(), p=performance.now();
    const rows=await tx.$queryRaw<Array<{pid:number}>>`SELECT 1, pg_backend_pid() pid`;
    const duration=performance.now()-p;
    emit('select1',{start,end:Date.now(),duration,inside,pid:rows[0].pid}); return duration;
  };
  const outside=[];for(let i=0;i<10;i++)outside.push(await select(db,false));
  emit('select1_outside',stats(outside));
  await db.$transaction(async tx => {const inside=[];for(let i=0;i<10;i++)inside.push(await select(tx,true));emit('select1_inside',stats(inside));}, {timeout:15000,maxWait:15000});
  if (process.env.VENTAS_POSTGRES_LATENCIA_WRITE === '1') {
    const key=randomUUID();let category:number|undefined,product:number|undefined;
    const rollback=new Error('rollback diagnóstico');
    try {
      category=(await db.categoria.create({data:{nombre:key,slug:key}})).idCategoria;
      product=(await db.producto.create({data:{nombre:'Diagnóstico aislado',slug:key,idCategoria:category,estado:'Activo'}})).idProducto;
      const v=await db.productoVariante.create({data:{idProducto:product,sku:`DIAG-${key.slice(0,20)}`,inventario:{create:{stockActual:2000}}}});
      try { await db.$transaction(async tx => {
        const start=performance.now();
        const plan=await tx.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          UPDATE inventario SET stock_actual=stock_actual-150 WHERE id_variante=${v.idVariante} AND stock_actual>=150`;
        emit('write_explain',{node_ms:performance.now()-start,plan});
        expect((await tx.inventario.findUniqueOrThrow({where:{idVariante:v.idVariante}})).stockActual).toBe(1850);
        throw rollback;
      },{timeout:15000,maxWait:15000}); } catch(error){if(error!==rollback)throw error;}
      const stock=(await db.inventario.findUniqueOrThrow({where:{idVariante:v.idVariante}})).stockActual;
      expect(stock).toBe(2000);emit('write_rollback',{before:2000,after:stock});
    } finally {
      if(product!==undefined)await db.producto.delete({where:{idProducto:product}});
      if(category!==undefined)await db.categoria.delete({where:{idCategoria:category}});
    }
    return;
  }
  const pedidos=await import('../../src/services/pedido.service.js');
  const warmControl = process.env.VENTAS_POSTGRES_LATENCIA_WARM === '1';
  const rounds = process.env.VENTAS_POSTGRES_LATENCIA_R3 === '1' ? 10 : 5;
  for(let run=1;run<=(warmControl ? 1 : rounds);run++) {
    const key=randomUUID();let product:number|undefined,category:number|undefined,user:number|undefined;
    let observing=true;const samples:unknown[]=[];
    try {
      category=(await db.categoria.create({data:{nombre:key,slug:key}})).idCategoria;
      product=(await db.producto.create({data:{nombre:'Diagnóstico aislado',slug:key,idCategoria:category,estado:'Activo'}})).idProducto;
      const pres=await db.presentacionVenta.create({data:{idProducto:product,nombre:'Pack x50',cantidadBase:50,principal:true}});
      const perfil=await db.perfilPrecio.create({data:{idProducto:product,nombre:'Principal',principal:true}});
      await db.listaPrecio.create({data:{idProducto:product,nombre:'Principal',principal:true,idPresentacion:pres.idPresentacion,idPerfilPrecio:perfil.idPerfilPrecio,reglas:{create:{nombre:'Base',cantidadMinima:1,precioPorPresentacion:'32',principal:true}}}});
      const variant=await db.productoVariante.create({data:{idProducto:product,sku:`DIAG-${key.slice(0,20)}`,inventario:{create:{stockActual:2000}}}});
      user=(await db.usuario.create({data:{nombre:'Diagnóstico',email:`${key}@example.invalid`,rol:'CLIENTE'}})).id_usuario;
      const cart = await db.carrito.create({data:{idUsuario:user,items:{create:{idVariante:variant.idVariante,idPresentacion:pres.idPresentacion,cantidad:3}}}});
      await select(db,false);
      // Observador read-only en otra sesión del MISMO pool; no toca locks de negocio.
      const observer=(async()=>{while(observing){
        const rows=await db.$queryRaw`SELECT pid,state,wait_event_type,wait_event,query_start,xact_start,backend_start,
          backend_xid::text,query,pg_blocking_pids(pid) blockers,
          (SELECT json_agg(json_build_object('type',locktype,'mode',mode,'granted',granted,'relation',relation::regclass::text)) FROM pg_locks l WHERE l.pid=a.pid) locks
          FROM pg_stat_activity a WHERE datname=current_database() AND pid<>pg_backend_pid() AND application_name=${url.searchParams.get('application_name') ?? ''}`;
        samples.push({at:performance.now(),rows});
        if(observing)await new Promise(resolve=>setTimeout(resolve,100));
      }})();
      events=[];external=[];measuring=true;const start=performance.now();let result:string;let end=start;
      try {const order=await pedidos.crear(user,{nombreContacto:'Diagnóstico',telefonoContacto:'71234567',direccionEntrega:null});result=`pedido ${order.idPedido}`;}
      catch(error){result=error instanceof Error?error.message.replace(/\n/g,' '):'error';}
      finally { end=performance.now();observing=false;measuring=false;await observer; }
      const captured=events.slice();const operations=external.slice();
      emit('checkout',{run,start,end,duration:end-start,result,
        queries:captured.map(e=>({sql:e.query,duration:e.duration,end:e.at-start,start:e.at-start-e.duration})),
        operations:operations.map(e=>({...e,start:e.start-start,end:e.end-start,duration:e.end-e.start})),samples});
      if (warmControl) {
        // Sin sleep ni EXPLAIN entre compras: sólo reponer la línea del fixture.
        // Quedan 1850 unidades tras la primera compra; la segunda también requiere 150.
        // Si la primera compra hizo rollback, su línea ya existe y se reutiliza.
        await db.carritoDetalle.upsert({where:{idCarrito_idVariante_idPresentacion:{idCarrito:cart.idCarrito,idVariante:variant.idVariante,idPresentacion:pres.idPresentacion}},
          update:{cantidad:3},create:{idCarrito:cart.idCarrito,idVariante:variant.idVariante,idPresentacion:pres.idPresentacion,cantidad:3}});
        events=[];external=[];measuring=true;const warmStart=performance.now();
        let warmResult:string;
        try { const order=await pedidos.crear(user,{nombreContacto:'Diagnóstico',telefonoContacto:'71234567',direccionEntrega:null});warmResult=`pedido ${order.idPedido}`; }
        catch(error){warmResult=error instanceof Error?error.message.replace(/\n/g,' '):'error';}
        finally {
          const warmEnd=performance.now();measuring=false;
          emit('warm_checkout',{start:warmStart,end:warmEnd,duration:warmEnd-warmStart,result:warmResult!,
            queries:events.map(e=>({sql:e.query,duration:e.duration,end:e.at-warmStart,start:e.at-warmStart-e.duration})),
            operations:external.map(e=>({...e,start:e.start-warmStart,end:e.end-warmStart,duration:e.end-e.start}))});
        }
        await select(db,false);
      }
      // Replay sólo lecturas SIN locking; mismos parámetros del fixture. No se ejecutan escrituras.
      // Excluir explícitamente las consultas del observador.
      for(const e of captured.filter(e=>/^SELECT\b/i.test(e.query.trim())&&!/pg_stat_activity|FOR\s+(SHARE|UPDATE|NO|KEY)/i.test(e.query))) {
        const params=JSON.parse(e.params) as unknown[];t=performance.now();
        try {const plan=await db.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+e.query,...params);emit('explain',{run,sql:e.query,node_ms:performance.now()-t,plan});}
        catch(error){emit('explain_unavailable',{run,error:error instanceof Error?error.message:'error'});}
      }
      await select(db,false);
    } finally {
      observing=false;measuring=false;
      if(product!==undefined){await db.movimientoInventario.deleteMany({where:{variante:{idProducto:product}}});}
      if(user!==undefined){await db.pedido.deleteMany({where:{idUsuario:user}});await db.carrito.deleteMany({where:{idUsuario:user}});}
      if(product!==undefined)await db.producto.delete({where:{idProducto:product}});
      if(category!==undefined)await db.categoria.delete({where:{idCategoria:category}});
      if(user!==undefined)await db.usuario.delete({where:{id_usuario:user}});
      emit('cleanup',{run,products:await db.producto.count(),users:await db.usuario.count()});
    }
  }
},600000);
