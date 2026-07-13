/** Copy for contextual help tooltips across the admin panel. */

export const HELP = {
  finanzas: {
    estado:
      'Vista consolidada del periodo seleccionado: ingresos cobrados, egresos, saldos por fondo y comparativo vs presupuesto. Los KPIs usan criterio de caja (pagos aprobados y egresos pagados).',
    presupuesto:
      'Define montos anuales por categoría y fondo (operación o reserva). El seguimiento compara lo ejecutado en el periodo contra el presupuesto prorrateado.',
    cuotas:
      'Las cuotas periódicas generan cargos automáticos cada mes; las extraordinarias aplican un monto puntual. El alcance puede ser todo el condominio, una torre o una unidad.',
    movimientos:
      'Registra ingresos manuales y egresos, valida pagos de residentes y concilia el banco. Exporta CSV o póliza contable desde aquí.',
    cuentas:
      'Estado de cuenta por unidad: cargos, abonos, saldo y comprobantes. Útil para responder dudas de residentes.',
    proveedores:
      'Resumen de egresos tipo Proveedor (pagados y pendientes), agrupados por nombre. Se registran en Ingresos y egresos, no en esta pestaña.',
    nomina:
      'Resumen de egresos tipo Nómina (pagados y pendientes). Se registran en Ingresos y egresos, no en esta pestaña.',
    morosidad:
      'Cargos vencidos por torre (generados desde Cuotas), recargos, recordatorios y planes de pago. Aquí se gestionan; no se capturan adeudos manuales.',
    cumplimiento:
      'Políticas de aprobación, mapeo a cuentas contables y (cuando esté activo) CFDI. No se registran movimientos aquí; la póliza se exporta desde Ingresos y egresos.',
  },
  cuotas: {
    periodica:
      'Cuota recurrente mensual. El día de vencimiento define cuándo se marca atraso; el coeficiente reparte el monto entre unidades del alcance.',
    extraordinaria:
      'Cargo único por campaña (obra, seguro, etc.). Puedes limitar a torres o unidades y fijar fecha de vencimiento.',
  },
  pagos: {
    validar:
      'Residentes suben comprobante de transferencia. Aprueba para aplicar el abono a cargos (FIFO). Rechaza si el comprobante no coincide.',
    segunda:
      'Maker-checker: un segundo administrador distinto debe confirmar montos altos antes de liquidar cargos.',
    oxxoSpei:
      'Pagos en línea con referencia pendiente. Se aprueban solos cuando Stripe confirma el abono (webhook async).',
    historial: 'Pagos ya procesados con su estado final, método y unidad.',
  },
  morosidad: {
    recargos:
      'Aplica mora tras días de gracia. Puede ser monto fijo o porcentaje, una vez o recurrente, y se asigna al fondo que elijas.',
    recordatorios:
      'Envía aviso push/correo X días después del vencimiento. El cron diario ejecuta reglas activas.',
    cartera:
      'Adeudos = cuotas/cargos vencidos (y recargos si están activos). No se capturan aquí; cobra en pagos o estado de cuenta. Condona, recuerda o abre el estado de la unidad.',
  },
  planes:
    'Acuerdo de parcialidades sobre cargos morosos. Al aprobar un pago con parcialidad, se liquida la cuota del plan y luego los cargos vinculados.',
  presupuesto:
    'Captura el presupuesto anual por categoría. El panel muestra avance del año o del mes según el filtro de periodo en Estado financiero.',
  banco: {
    cuentas: 'Registra cuentas bancarias del condominio para importar movimientos y conciliar.',
    import:
      'Sube OFX/QFX del banco o pega CSV (fecha, monto, descripción, referencia). Los movimientos quedan pendientes hasta que los enlaces.',
    conciliar:
      'Empareja cada línea del banco con un pago aprobado, ingreso manual o egreso. Marca como conciliado cuando cuadre.',
  },
  cumplimiento: {
    makerChecker:
      'Solo aplica a transferencias con comprobante. Pagos en línea (tarjeta/Oxxo/SPEI) no pasan por doble aprobación.',
    export:
      'Mapea categorías Veka a cuentas del catálogo contable. Descarga la póliza CSV desde Ingresos y egresos.',
    cfdiPausa:
      'Facturación electrónica cuando el condominio y las unidades tengan datos fiscales. Por ahora está pausada en el piloto.',
    speiOxxo:
      'Los residentes pagan con Oxxo o SPEI si Stripe México y los webhooks async están configurados en la pasarela.',
  },
  comunidad: {
    avisos: 'Publica comunicados visibles para residentes en la app. Puedes fijar prioridad o vigencia.',
    encuestas: 'Crea votaciones formales o consultas informales. Las formales pueden requerir quórum según configuración.',
    documentos: 'Reglamento, minutas y archivos del condominio visibles en la app (pestaña Documentos).',
    miComunidad:
      'Directorio público del equipo (solo lectura): staff admin, mantenimiento y seguridad. El comité de vigilancia se agrega desde residentes del directorio. Las invitaciones de roles de app viven en Configuración → Equipo.',
    asambleas:
      'Expediente de cada asamblea: vincula avisos, encuestas y documentos ya publicados, y da seguimiento a acuerdos con checklist (opcionalmente ligados a tickets de mantenimiento).',
  },
  mantenimiento:
    'Programa actividades por día (semanal, quincenal, mensual o a demanda) y registra evidencia fotográfica por fecha. Los residentes consultan el programa y filtran evidencia por mes.',
  seguridad:
    'Caseta: valida pases QR, registra paquetes (con foto) y opera visitas/entregas del día. Los chips Todo/torre filtran unidades y la bitácora. Las políticas de rentas con adeudo las edita administración.',
  unidades:
    'Torres (clusters) y unidades con coeficiente de participación. Desde aquí envías invitaciones a residentes.',
  equipo:
    'Invita y gestiona usuarios con rol en la app: staff admin, mantenimiento y seguridad. Desde aquí decides si el teléfono del staff se muestra en Comunidad → Mi comunidad.',
  condominio:
    'Datos generales, zona horaria y branding (logo/colores) que ven residentes en la app y en correos.',
  residente:
    'Consulta cargos pendientes, sube comprobante o paga en línea. Los abonos parciales se aplican al cargo más antiguo primero.',
} as const;
