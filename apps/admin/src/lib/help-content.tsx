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
    proveedores: 'Directorio de proveedores vinculado a egresos. Registra RFC y contacto para trazabilidad.',
    nomina: 'Empleados del condominio y egresos de nómina asociados.',
    morosidad:
      'Cargos vencidos por torre, recargos automáticos, recordatorios y planes de pago. Puedes condonar saldos o abrir un plan de parcialidades.',
    contabilidad:
      'Maker-checker para transferencias, mapeo a cuentas contables y export de póliza. La facturación CFDI está pausada hasta tener datos fiscales.',
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
      'Cargos vencidos agrupados por torre. Condona saldo o abre estado de cuenta de la unidad.',
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
  contabilidad: {
    makerChecker:
      'Solo aplica a transferencias con comprobante. Pagos en línea (tarjeta/Oxxo/SPEI) no pasan por doble aprobación.',
    export:
      'Mapea categorías Veka a cuentas del catálogo contable. Descarga la póliza CSV desde Ingresos y egresos.',
    cfdiPausa:
      'Cuando tengas RFC del condominio y de cada unidad, activa CFDI_BILLING_ENABLED en el servidor y configura Facturapi.',
    speiOxxo:
      'Requiere Oxxo y SPEI habilitados en Stripe México y webhooks async en la pasarela.',
  },
  comunidad: {
    avisos: 'Publica comunicados visibles para residentes en la app. Puedes fijar prioridad o vigencia.',
    encuestas: 'Crea votaciones formales o consultas informales. Las formales pueden requerir quórum según configuración.',
  },
  mantenimiento:
    'Programa actividades por día (semanal, quincenal, mensual o a demanda) y registra evidencia fotográfica por fecha. Los residentes consultan el programa y filtran evidencia por mes.',
  unidades:
    'Torres (clusters) y unidades con coeficiente de participación. Desde aquí envías invitaciones a residentes.',
  equipo: 'Administradores con acceso al panel. Roles: super_admin y admin según membresía.',
  condominio:
    'Datos generales, zona horaria y branding (logo/colores) que ven residentes en la app y en correos.',
  residente:
    'Consulta cargos pendientes, sube comprobante o paga en línea. Los abonos parciales se aplican al cargo más antiguo primero.',
} as const;
