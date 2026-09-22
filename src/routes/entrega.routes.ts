import { Router } from 'express'; import * as c from '../controllers/entrega.controller.js'; const r=Router(); r.get('/puntos',c.puntos);r.get('/configuracion',c.configuracion);export default r;
