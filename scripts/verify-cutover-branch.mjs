// Ejecutar con node --import tsx scripts/verify-cutover-branch.mjs.
// URL por stdin, CUTOVER_TEST_HOST explícito; production está bloqueada.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
const rl=createInterface({input:process.stdin});let uri;for await(const line of rl){uri=line.trim();break;}rl.close();
const url=new URL(uri);assert.ok(process.env.CUTOVER_TEST_HOST, 'Falta CUTOVER_TEST_HOST');assert.notEqual(url.hostname,'ep-muddy-cloud-acebei4s.sa-east-1.aws.neon.tech', 'Production está prohibida');assert.equal(url.hostname,process.env.CUTOVER_TEST_HOST);assert.equal(url.pathname,'/neondb');
process.env.DATABASE_URL=uri;process.env.NODE_ENV='test';
const {default:db}=await import('../src/config/prisma.ts');
const cart=await import('../src/services/carrito.service.ts');
const orders=await import('../src/services/pedido.service.ts');
const contact={nombreContacto:'Prueba Cutover',telefonoContacto:'71234567',direccionEntrega:null};
const passed=[];const ok=name=>{passed.push(name);console.log('PASS '+name);};
let users=[],extraPres,extraProfile,originalPres,assigned;
const stock=(id,n)=>db.inventario.update({where:{idVariante:id},data:{stockActual:n}});
const value=async id=>(await db.inventario.findUniqueOrThrow({where:{idVariante:id}})).stockActual;
const clear=async user=>db.carritoDetalle.deleteMany({where:{carrito:{idUsuario:user}}});
try{
 assert.equal(await db.inventario.count(),await db.productoVariante.count());assert.equal(await db.inventario.count({where:{stockActual:{not:0}}}),0);ok('inventario reinicializado a cero');
 const products=await db.producto.findMany({include:{variantes:{orderBy:{idVariante:'asc'}},presentaciones:true,perfilesPrecio:true}});
 const cort=products.find(p=>p.nombre.startsWith('Cortina')),crom=products.find(p=>p.nombre.startsWith('Globo Cromado')),led=products.find(p=>p.nombre.startsWith('Alambre'));
 const a=cort.variantes[0].idVariante,b=cort.variantes[1].idVariante,v=crom.variantes[0].idVariante;
 for(let i=0;i<2;i++)users.push((await db.usuario.create({data:{nombre:'Fixture Cutover',email:`cutover-${Date.now()}-${i}@example.invalid`,rol:'CLIENTE'}})).id_usuario);
 const [u,u2]=users;await stock(a,1000);await stock(b,1000);await stock(v,200);
 await cart.agregarItem(u,{idVariante:a,cantidad:3});await cart.agregarItem(u,{idVariante:b,cantidad:3});
 let view=await cart.obtenerCarrito(u);assert.equal(view.total,'47.52');assert.equal(view.gruposPrecio[0].cantidadTotalGrupo,6);assert.deepEqual(view.items.map(i=>i.subtotal),['23.76','23.76']);ok('Cortina 3+3 grupo6 precio7.92 total47.52; frontend legacy');
 let order=await orders.crear(u,contact);assert.equal(order.total.toFixed(2),'47.52');assert.equal((await cart.obtenerCarrito(u)).items.length,0);assert.equal(await value(a),997);ok('checkout Cortina vacía carrito y consume base');await orders.cambiarEstado(order.idPedido,'CANCELADO');
 await cart.agregarItem(u,{idVariante:a,cantidad:30});await cart.agregarItem(u,{idVariante:b,cantidad:30});view=await cart.obtenerCarrito(u);assert.equal(view.total,'409.80');assert.equal(view.items[0].precioPorPresentacion,'6.83');ok('Cortina 60 precio6.83 exacto');await clear(u);
 await stock(led.variantes[0].idVariante,100);await cart.agregarItem(u,{idVariante:led.variantes[0].idVariante,cantidad:12});view=await cart.obtenerCarrito(u);assert.equal(view.total,'53.04');assert.equal(view.items[0].precioPorPresentacion,'4.42');ok('LED12 precio4.42 exacto');await clear(u);
 await cart.agregarItem(u,{idVariante:v,cantidad:3});view=await cart.obtenerCarrito(u);assert.equal(view.items[0].cantidadBaseTotal,150);assert.equal(view.items[0].stock,4);assert.equal(view.items[0].stockBase,200);
 order=await orders.crear(u,contact);assert.equal(await value(v),50);const details=await db.pedidoDetalle.findMany({where:{idPedido:order.idPedido}});assert.equal(details[0].cantidad,3);assert.equal(details[0].cantidadBasePresentacion,50);assert.equal(details[0].precioUnitario.toString(),'32');assert.equal(details[0].presentacionNombre,'Pack x50');
 assert.equal((await db.movimientoInventario.findFirstOrThrow({where:{motivo:`Pedido #${order.idPedido}`}})).cantidad,150);ok('Cromado200 -> checkout3packs ->50; snapshot50 y salida150');
 await orders.cambiarEstado(order.idPedido,'CONFIRMADO');assert.equal(await value(v),50);ok('confirmación no vuelve a descontar');
 originalPres={...crom.presentaciones[0]};await db.presentacionVenta.update({where:{idPresentacion:originalPres.idPresentacion},data:{cantidadBase:40}});
 await orders.cambiarEstado(order.idPedido,'CANCELADO');assert.equal(await value(v),200);assert.equal((await db.movimientoInventario.findFirstOrThrow({where:{motivo:`Cancelación Pedido #${order.idPedido}`}})).cantidad,150);ok('cancelación usa snapshot50 pese a presentación actual40; stock50->200');
 const countMoves=await db.movimientoInventario.count();await orders.cambiarEstado(order.idPedido,'CANCELADO');assert.equal(await value(v),200);assert.equal(await db.movimientoInventario.count(),countMoves);ok('segunda cancelación no duplica devolución');
 await db.presentacionVenta.update({where:{idPresentacion:originalPres.idPresentacion},data:{cantidadBase:originalPres.cantidadBase,fechaActualizacion:originalPres.fechaActualizacion}});
 extraPres=await db.presentacionVenta.create({data:{idProducto:crom.idProducto,nombre:'Unidad fixture',cantidadBase:1}});
 await db.listaPrecio.create({data:{idProducto:crom.idProducto,nombre:'Unidad fixture',idPresentacion:extraPres.idPresentacion,idPerfilPrecio:crom.perfilesPrecio[0].idPerfilPrecio,reglas:{create:[{nombre:'Base',cantidadMinima:1,precioPorPresentacion:5,principal:true},{nombre:'Desde12',cantidadMinima:12,precioPorPresentacion:3}]}}});
 await assert.rejects(cart.agregarItem(u,{idVariante:v,idPresentacion:cort.presentaciones[0].idPresentacion,cantidad:1}),e=>e.statusCode===400);ok('presentación ajena rechazada');
 await db.presentacionVenta.update({where:{idPresentacion:extraPres.idPresentacion},data:{activo:false}});await assert.rejects(cart.agregarItem(u,{idVariante:v,idPresentacion:extraPres.idPresentacion,cantidad:1}),e=>e.statusCode===409);await db.presentacionVenta.update({where:{idPresentacion:extraPres.idPresentacion},data:{activo:true}});ok('presentación inactiva rechazada');
 await stock(v,100);await cart.agregarItem(u,{idVariante:v,idPresentacion:extraPres.idPresentacion,cantidad:60});await assert.rejects(cart.agregarItem(u,{idVariante:v,cantidad:1}),e=>e.statusCode===400);ok('stock base total rechaza60unidades+1pack contra100');
 view=await cart.obtenerCarrito(u);await cart.actualizarItem(u,view.items[0].idDetalle,40);await cart.agregarItem(u,{idVariante:v,cantidad:1});view=await cart.obtenerCarrito(u);assert.equal(view.items.length,2);await assert.rejects(cart.actualizarItem(u,view.items.find(i=>i.idPresentacion===extraPres.idPresentacion).idDetalle,60),e=>e.statusCode===400);ok('update considera consumo de ambas presentaciones');
 await cart.eliminarItem(u,view.items.find(i=>i.idPresentacion!==extraPres.idPresentacion).idDetalle);assert.equal((await cart.obtenerCarrito(u)).items.length,1);ok('delete afecta solo idDetalle');await clear(u);await stock(v,200);
 await cart.agregarItem(u,{idVariante:v,idPresentacion:extraPres.idPresentacion,cantidad:2});await cart.agregarItem(u,{idVariante:v,idPresentacion:extraPres.idPresentacion,cantidad:3});await cart.agregarItem(u,{idVariante:v,cantidad:3});view=await cart.obtenerCarrito(u);assert.equal(view.items.length,2);assert.equal(view.items.find(i=>i.idPresentacion===extraPres.idPresentacion).cantidad,5);assert.equal(view.gruposPrecio.length,2);ok('upsert por triple; misma variante dos presentaciones coexisten sin agrupar');
 const carrito=(await db.carrito.findUniqueOrThrow({where:{idUsuario:u}})).idCarrito;
 await assert.rejects(db.carritoDetalle.create({data:{idCarrito:carrito,idVariante:v,idPresentacion:extraPres.idPresentacion,cantidad:1}}),e=>e.code==='P2002');
 await assert.rejects(db.carritoDetalle.create({data:{idCarrito:carrito,idVariante:v,idPresentacion:2147483646,cantidad:1}}),e=>e.code==='P2003');
 await assert.rejects(db.$executeRaw`INSERT INTO carrito_detalle(id_carrito,id_variante,cantidad) VALUES(${carrito},${v},1)`);ok('unique triple, FK y NOT NULL comprobados');
 order=await orders.crear(u,contact);assert.equal(await value(v),45);const multi=await db.pedidoDetalle.findMany({where:{idPedido:order.idPedido}});assert.equal(multi.length,2);assert.equal((await db.movimientoInventario.findFirstOrThrow({where:{motivo:`Pedido #${order.idPedido}`}})).cantidad,155);ok('checkout misma variante dos presentaciones descuenta155 una vez');
 await db.listaPrecio.deleteMany({where:{idPresentacion:extraPres.idPresentacion}});await db.presentacionVenta.delete({where:{idPresentacion:extraPres.idPresentacion}});extraPres=null;assert.equal((await db.pedidoDetalle.findFirstOrThrow({where:{idPedido:order.idPedido,presentacionNombre:'Unidad fixture'}})).idPresentacion,null);await orders.cambiarEstado(order.idPedido,'CANCELADO');assert.equal(await value(v),200);ok('historial SET NULL y cancelación agrega snapshots155 sin presentación viva');
 extraProfile=await db.perfilPrecio.create({data:{idProducto:cort.idProducto,nombre:'Especial fixture'}});
 await db.listaPrecio.create({data:{idProducto:cort.idProducto,nombre:'Especial fixture',idPresentacion:cort.presentaciones[0].idPresentacion,idPerfilPrecio:extraProfile.idPerfilPrecio,reglas:{create:[{nombre:'Base',cantidadMinima:1,precioPorPresentacion:7,principal:true},{nombre:'Desde12',cantidadMinima:12,precioPorPresentacion:5}]}}});
 assigned=b;await db.productoVariante.update({where:{idVariante:b},data:{idPerfilPrecio:extraProfile.idPerfilPrecio}});
 await cart.agregarItem(u,{idVariante:a,cantidad:6});await cart.agregarItem(u,{idVariante:b,cantidad:6});view=await cart.obtenerCarrito(u);assert.equal(view.gruposPrecio.length,2);assert.deepEqual(view.items.map(i=>i.precioPorPresentacion),['7.92','7.00']);ok('perfiles distintos no suman cantidades');await clear(u);
 await cart.agregarItem(u,{idVariante:v,cantidad:3});await stock(v,100);const pedidosAntes=await db.pedido.count(),movAntes=await db.movimientoInventario.count();await assert.rejects(orders.crear(u,contact),e=>e.statusCode===400);assert.equal(await value(v),100);assert.equal(await db.pedido.count(),pedidosAntes);assert.equal(await db.movimientoInventario.count(),movAntes);assert.equal((await cart.obtenerCarrito(u)).items.length,1);ok('stock insuficiente rollback total y conserva carrito');
 await stock(v,200);await assert.rejects(orders.crear(u,{...contact,nombreContacto:'X'.repeat(151)}));assert.equal(await value(v),200);assert.equal(await db.pedido.count(),pedidosAntes);assert.equal(await db.movimientoInventario.count(),movAntes);assert.equal((await cart.obtenerCarrito(u)).items.length,1);ok('fallo real creando pedido revierte decremento y conserva carrito');
 await cart.agregarItem(u2,{idVariante:v,cantidad:3});const concurrent=await Promise.allSettled([orders.crear(u,contact),orders.crear(u2,contact)]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(await value(v),50);assert.equal(await db.pedido.count(),pedidosAntes+1);ok('concurrencia: dos compras150 contra200; solo una exitosa, stock50');
 console.log(JSON.stringify({realTestsPassed:passed.length,tests:passed}));
}catch(e){console.error(String(e.message).replace(uri,'[URI]').replace(url.password,'[SECRET]'));process.exitCode=1;}
finally{
 await db.movimientoInventario.deleteMany();await db.carritoDetalle.deleteMany();await db.carrito.deleteMany();await db.pedidoDetalle.deleteMany();await db.pedido.deleteMany();await db.inventario.updateMany({data:{stockActual:0}});
 if(assigned)await db.productoVariante.update({where:{idVariante:assigned},data:{idPerfilPrecio:null}});
 if(extraProfile){await db.listaPrecio.deleteMany({where:{idPerfilPrecio:extraProfile.idPerfilPrecio}});await db.perfilPrecio.delete({where:{idPerfilPrecio:extraProfile.idPerfilPrecio}});}
 if(extraPres){await db.listaPrecio.deleteMany({where:{idPresentacion:extraPres.idPresentacion}});await db.presentacionVenta.delete({where:{idPresentacion:extraPres.idPresentacion}});}
 if(originalPres)await db.presentacionVenta.update({where:{idPresentacion:originalPres.idPresentacion},data:{cantidadBase:originalPres.cantidadBase,fechaActualizacion:originalPres.fechaActualizacion}});
 if(users.length)await db.usuario.deleteMany({where:{id_usuario:{in:users}}});await db.$disconnect();
}
