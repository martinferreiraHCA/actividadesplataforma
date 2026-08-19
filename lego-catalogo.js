// Catálogo de piezas LEGO disponibles para las guías de ensamble.
// Cada pieza referencia un archivo .dat de la biblioteca LDraw local (lego/ldraw/).
// "w" y "d" son el tamaño en studs según la orientación nativa del archivo LDraw
// (el lado largo va sobre el eje X sin rotar); "alto" está en placas (3 placas = 1 ladrillo).
// "studs": cuántas filas de studs tiene arriba ('todas', 'ninguna' o un número de filas).

// "nxt": cuántas unidades trae UN kit LEGO Mindstorms NXT Education (9797).
// Las piezas sin "nxt" no vienen en ese kit. "bbox: true" indica al motor que
// ubique la pieza por su caja medida (vigas dobladas, electrónica y otras
// piezas cuyo origen LDraw no está centrado en la huella).

export const CATEGORIAS = ['Ladrillos', 'Placas', 'Lisas', 'Pendientes', 'Redondas', 'Técnicas', 'Vigas NXT', 'Engranajes', 'Ruedas', 'Electrónica NXT', 'Especiales'];

export const KITS = {
  nxt: {
    clave: 'nxt',
    nombre: 'Kit LEGO Mindstorms NXT (Education 9797)',
    descripcion: 'Vigas técnicas, pines, ejes, engranajes, ruedas, el bloque NXT, 3 motores y los sensores del set educativo 9797.'
  }
};

export const PIEZAS = [
  // --- Ladrillos ---
  { clave: 'ladrillo 1x1', dat: '3005', nombre: 'Ladrillo 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x2', dat: '3004', nombre: 'Ladrillo 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos', nxt: 8, },
  { clave: 'ladrillo 1x3', dat: '3622', nombre: 'Ladrillo 1×3', w: 3, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x4', dat: '3010', nombre: 'Ladrillo 1×4', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x6', dat: '3009', nombre: 'Ladrillo 1×6', w: 6, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x8', dat: '3008', nombre: 'Ladrillo 1×8', w: 8, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x2', dat: '3003', nombre: 'Ladrillo 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos', nxt: 4, },
  { clave: 'ladrillo 2x3', dat: '3002', nombre: 'Ladrillo 2×3', w: 3, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x4', dat: '3001', nombre: 'Ladrillo 2×4', w: 4, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x6', dat: '2456', nombre: 'Ladrillo 2×6', w: 6, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x8', dat: '3007', nombre: 'Ladrillo 2×8', w: 8, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  // --- Placas ---
  { clave: 'placa 1x1', dat: '3024', nombre: 'Placa 1×1', w: 1, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x2', dat: '3023', nombre: 'Placa 1×2', w: 2, d: 1, alto: 1, studs: 'todas', cat: 'Placas', nxt: 4, },
  { clave: 'placa 1x3', dat: '3623', nombre: 'Placa 1×3', w: 3, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x4', dat: '3710', nombre: 'Placa 1×4', w: 4, d: 1, alto: 1, studs: 'todas', cat: 'Placas', nxt: 4, },
  { clave: 'placa 1x6', dat: '3666', nombre: 'Placa 1×6', w: 6, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x8', dat: '3460', nombre: 'Placa 1×8', w: 8, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x2', dat: '3022', nombre: 'Placa 2×2', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x3', dat: '3021', nombre: 'Placa 2×3', w: 3, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x4', dat: '3020', nombre: 'Placa 2×4', w: 4, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x6', dat: '3795', nombre: 'Placa 2×6', w: 6, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x8', dat: '3034', nombre: 'Placa 2×8', w: 8, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x4', dat: '3031', nombre: 'Placa 4×4', w: 4, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x6', dat: '3032', nombre: 'Placa 4×6', w: 6, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x8', dat: '3035', nombre: 'Placa 4×8', w: 8, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x10', dat: '3030', nombre: 'Placa 4×10', w: 10, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 6x6', dat: '3958', nombre: 'Placa 6×6', w: 6, d: 6, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 6x8', dat: '3036', nombre: 'Placa 6×8', w: 8, d: 6, alto: 1, studs: 'todas', cat: 'Placas' },
  // --- Lisas (tiles, sin studs arriba) ---
  { clave: 'lisa 1x1', dat: '3070b', nombre: 'Lisa 1×1 (tile)', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 1x2', dat: '3069b', nombre: 'Lisa 1×2 (tile)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas', nxt: 2, },
  { clave: 'lisa 1x4', dat: '2431', nombre: 'Lisa 1×4 (tile)', w: 4, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 1x6', dat: '6636', nombre: 'Lisa 1×6 (tile)', w: 6, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 2x2', dat: '3068b', nombre: 'Lisa 2×2 (tile)', w: 2, d: 2, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 2x4', dat: '87079', nombre: 'Lisa 2×4 (tile)', w: 4, d: 2, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  // --- Pendientes (techos) ---
  { clave: 'cuna 1x1', dat: '54200', nombre: 'Cuña 1×1 (mini pendiente)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Pendientes' },
  { clave: 'pendiente 1x2', dat: '3040b', nombre: 'Pendiente 45° 1×2', w: 2, d: 1, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x2', dat: '3039', nombre: 'Pendiente 45° 2×2', w: 2, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x3', dat: '3038', nombre: 'Pendiente 45° 2×3', w: 3, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x4', dat: '3037', nombre: 'Pendiente 45° 2×4', w: 4, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente invertida 1x2', dat: '3665', nombre: 'Pendiente invertida 45° 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Pendientes' },
  { clave: 'pendiente invertida 2x2', dat: '3660', nombre: 'Pendiente invertida 45° 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Pendientes' },
  // --- Redondas ---
  { clave: 'placa redonda 1x1', dat: '4073', nombre: 'Placa redonda 1×1', w: 1, d: 1, alto: 1, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'ladrillo redondo 1x1', dat: '3062b', nombre: 'Ladrillo redondo 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'cono 1x1', dat: '4589', nombre: 'Cono 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'placa redonda 2x2', dat: '4032a', nombre: 'Placa redonda 2×2', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'ladrillo redondo 2x2', dat: '3941', nombre: 'Ladrillo redondo 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  // --- Técnicas ---
  { clave: 'tecnico 1x2', dat: '3700', nombre: 'Ladrillo técnico 1×2 (1 agujero)', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 4, },
  { clave: 'tecnico 1x4', dat: '3701', nombre: 'Ladrillo técnico 1×4 (3 agujeros)', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 4, },
  { clave: 'tecnico 1x6', dat: '3894', nombre: 'Ladrillo técnico 1×6 (5 agujeros)', w: 6, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 4, },
  { clave: 'tecnico 1x8', dat: '3702', nombre: 'Ladrillo técnico 1×8 (7 agujeros)', w: 8, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 4, },
  { clave: 'eje 2', dat: '3704', nombre: 'Eje técnico 2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'eje 4', dat: '3705', nombre: 'Eje técnico 4', w: 4, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 6, },
  { clave: 'eje 5', dat: '32073', nombre: 'Eje técnico 5', w: 5, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 8, },
  { clave: 'eje 12', dat: '3708', nombre: 'Eje técnico 12', w: 12, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 2, },
  { clave: 'pin', dat: '2780', nombre: 'Pin técnico (con fricción)', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 60, },
  { clave: 'pin liso', dat: '3673', nombre: 'Pin técnico liso', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'pin largo', dat: '6558', nombre: 'Pin técnico largo (3L)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 72, },
  { clave: 'pin eje', dat: '43093', nombre: 'Pin-eje técnico', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true, nxt: 10, },
  { clave: 'medio pin', dat: '4274', nombre: 'Medio pin técnico', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  // --- Ruedas ---
  { clave: 'placa con ruedas 2x2', dat: '4600', nombre: 'Placa 2×2 con pernos de rueda', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Ruedas' },
  { clave: 'placa con ruedas 1x4', dat: '2926', nombre: 'Placa 1×4 con pernos de rueda', w: 4, d: 1, alto: 1, studs: 'todas', cat: 'Ruedas' },
  { clave: 'llanta chica', dat: '4624', nombre: 'Llanta chica (8mm)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'neumatico chico', dat: '3641', nombre: 'Neumático chico', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'llanta mediana', dat: '6014', nombre: 'Llanta mediana (11mm)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'neumatico mediano', dat: '6015', nombre: 'Neumático mediano', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  // --- Especiales ---
  { clave: 'faro 1x1', dat: '4070', nombre: 'Ladrillo faro 1×1 (headlight)', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'ladrillo stud lateral', dat: '87087', nombre: 'Ladrillo 1×1 con stud lateral', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'rejilla 1x2', dat: '2877', nombre: 'Ladrillo rejilla 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'techo curvo 1x2', dat: '6091', nombre: 'Ladrillo techo curvo 1×2', w: 2, d: 1, alto: 4, studs: 1, cat: 'Especiales' },
  { clave: 'soporte 1x2', dat: '99780', nombre: 'Soporte (bracket) 1×2 – 1×2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'soporte 1x2 arriba', dat: '99207', nombre: 'Soporte invertido 1×2 – 2×2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'arco 1x4', dat: '3659', nombre: 'Arco 1×4', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'antena', dat: '3957a', nombre: 'Antena 1×1×4', w: 1, d: 1, alto: 12, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel 1x2', dat: '4865b', nombre: 'Panel 1×2×1', w: 2, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel 1x4', dat: '30413', nombre: 'Panel 1×4×1', w: 4, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel esquina 1x1', dat: '6231', nombre: 'Panel esquina 1×1×1', w: 1, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },

  // ================= Kit LEGO Mindstorms NXT (Education 9797) =================
  // --- Vigas técnicas (liftarms, sin studs) ---
  { clave: 'viga 3', dat: '32523', nombre: 'Viga técnica 3', w: 3, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 10, preRot: 90 },
  { clave: 'viga 5', dat: '32316', nombre: 'Viga técnica 5', w: 5, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, preRot: 90 },
  { clave: 'viga 7', dat: '32524', nombre: 'Viga técnica 7', w: 7, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, preRot: 90 },
  { clave: 'viga 9', dat: '64289', nombre: 'Viga técnica 9', w: 9, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 6, preRot: 90 },
  { clave: 'viga 11', dat: '64290', nombre: 'Viga técnica 11', w: 11, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 2, preRot: 90 },
  { clave: 'viga 13', dat: '41239', nombre: 'Viga técnica 13', w: 13, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 2, preRot: 90 },
  { clave: 'viga 15', dat: '64871', nombre: 'Viga técnica 15', w: 15, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, preRot: 90 },
  { clave: 'viga angular 3x5', dat: '32526', nombre: 'Viga angular 3×5 (90°)', w: 3, d: 5, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 8, bbox: true },
  { clave: 'viga angular 2x4', dat: '32140', nombre: 'Viga angular 2×4 (90°)', w: 2, d: 4, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, bbox: true },
  { clave: 'viga angular 4x6', dat: '6629', nombre: 'Viga angular 4×6 (53°)', w: 3, d: 8, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, bbox: true },
  { clave: 'viga doble angular 3x7', dat: '32009', nombre: 'Viga doble angular 3×7 (45°)', w: 5, d: 9, alto: 2.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, bbox: true },
  { clave: 'viga curva 3x5', dat: '32250', nombre: 'Viga curva 3×5 (media, cuarto de elipse)', w: 3, d: 5, alto: 1.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 4, bbox: true },
  { clave: 'viga 3 con pines', dat: '48989', nombre: 'Viga 3 con 4 pines', w: 3, d: 1, alto: 3, studs: 'ninguna', cat: 'Vigas NXT', nxt: 2, bbox: true },
  { clave: 'viga angular con pines', dat: '55615', nombre: 'Viga angular 3×3 (90°) con 4 pines', w: 3, d: 3, alto: 3, studs: 'ninguna', cat: 'Vigas NXT', nxt: 6, bbox: true },
  { clave: 'brazo de direccion 3', dat: '33299a', nombre: 'Brazo de dirección 3 (media viga con pin)', w: 3, d: 1, alto: 1.5, studs: 'ninguna', cat: 'Vigas NXT', nxt: 2, bbox: true },
  // --- Bloques, conectores, pines, bujes y ejes del kit ---
  { clave: 'bloque cruz 1x2', dat: '6536', nombre: 'Bloque cruz 1×2 (eje/pin)', w: 2, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 20, bbox: true },
  { clave: 'bloque cruz 1x3', dat: '42003', nombre: 'Bloque cruz 1×3 (eje/pin/pin)', w: 3, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 4, bbox: true },
  { clave: 'bloque cruz doble', dat: '32184', nombre: 'Bloque cruz doble 1×3 (eje/pin/eje)', w: 3, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 8, bbox: true },
  { clave: 'bloque cruz 2x2', dat: '32291', nombre: 'Bloque cruz 2×2 (eje/pin doble)', w: 2, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 2, bbox: true },
  { clave: 'conector recto', dat: '32034', nombre: 'Conector angular recto (180°)', w: 2, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 2, suelta: true, bbox: true },
  { clave: 'pin doble con cruz', dat: '32138', nombre: 'Pin doble 3L con agujero de eje', w: 3, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 2, suelta: true, bbox: true },
  { clave: 'acople de ejes', dat: '6538a', nombre: 'Acople de ejes (con nervaduras)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 4, suelta: true },
  { clave: 'acople de ejes liso', dat: '59443', nombre: 'Acople de ejes liso 2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 4, suelta: true },
  { clave: 'pin con tope', dat: '32054', nombre: 'Pin largo con tope (buje)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 8, suelta: true },
  { clave: 'pin eje beige', dat: '6562', nombre: 'Pin-eje beige', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 8, suelta: true },
  { clave: 'buje', dat: '6590', nombre: 'Buje para eje', w: 1, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 10, suelta: true, redonda: true },
  { clave: 'medio buje', dat: '32123a', nombre: 'Medio buje', w: 1, d: 1, alto: 2.5, studs: 'ninguna', cat: 'Técnicas', nxt: 10, suelta: true, redonda: true },
  { clave: 'eje 2 con muesca', dat: '32062', nombre: 'Eje técnico 2 con muesca (rojo)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 8, suelta: true },
  { clave: 'eje 3', dat: '4519', nombre: 'Eje técnico 3', w: 3, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 14, suelta: true },
  { clave: 'eje 6', dat: '3706', nombre: 'Eje técnico 6', w: 6, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 4, suelta: true },
  { clave: 'eje 8', dat: '3707', nombre: 'Eje técnico 8', w: 8, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 2, suelta: true },
  { clave: 'eje 10', dat: '3737', nombre: 'Eje técnico 10', w: 10, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 2, suelta: true },
  { clave: 'eje con tope', dat: '59426', nombre: 'Eje técnico 5.5 con tope', w: 6, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', nxt: 2, suelta: true },
  // --- Ladrillos y placas técnicas del kit ---
  { clave: 'tecnico 1x16', dat: '3703', nombre: 'Ladrillo técnico 1×16 (15 agujeros)', w: 16, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 4 },
  { clave: 'ladrillo con cruz', dat: '32064a', nombre: 'Ladrillo 1×2 con agujero de eje', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas', nxt: 2 },
  { clave: 'placa tecnica 2x4', dat: '3709b', nombre: 'Placa técnica 2×4 (con agujeros)', w: 4, d: 2, alto: 1, studs: 'todas', cat: 'Técnicas', nxt: 2 },
  { clave: 'placa tecnica 2x6', dat: '32001', nombre: 'Placa técnica 2×6 (con agujeros)', w: 6, d: 2, alto: 1, studs: 'todas', cat: 'Técnicas', nxt: 2 },
  { clave: 'placa tecnica 2x8', dat: '3738', nombre: 'Placa técnica 2×8 (con agujeros)', w: 8, d: 2, alto: 1, studs: 'todas', cat: 'Técnicas', nxt: 2 },
  // --- Engranajes ---
  { clave: 'engranaje 8', dat: '3647', nombre: 'Engranaje 8 dientes', w: 1, d: 1, alto: 3, studs: 'ninguna', cat: 'Engranajes', nxt: 8, suelta: true, redonda: true },
  { clave: 'engranaje 16', dat: '94925', nombre: 'Engranaje 16 dientes', w: 2, d: 1, alto: 5.5, studs: 'ninguna', cat: 'Engranajes', nxt: 4, suelta: true, redonda: true },
  { clave: 'engranaje 24', dat: '3648', nombre: 'Engranaje 24 dientes', w: 3, d: 1, alto: 8, studs: 'ninguna', cat: 'Engranajes', nxt: 8, suelta: true, redonda: true },
  { clave: 'engranaje 40', dat: '3649', nombre: 'Engranaje 40 dientes', w: 5, d: 1, alto: 13, studs: 'ninguna', cat: 'Engranajes', nxt: 2, suelta: true, redonda: true },
  { clave: 'corona 24', dat: '3650c', nombre: 'Corona 24 dientes', w: 3, d: 1, alto: 8, studs: 'ninguna', cat: 'Engranajes', nxt: 2, suelta: true, redonda: true },
  { clave: 'tornillo sin fin', dat: '4716', nombre: 'Tornillo sin fin', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Engranajes', nxt: 4, suelta: true },
  { clave: 'engranaje conico 12', dat: '32270', nombre: 'Engranaje doble cónico 12 dientes', w: 2, d: 1, alto: 4.5, studs: 'ninguna', cat: 'Engranajes', nxt: 4, suelta: true, redonda: true },
  { clave: 'engranaje conico 20', dat: '32269', nombre: 'Engranaje doble cónico 20 dientes', w: 3, d: 1, alto: 7, studs: 'ninguna', cat: 'Engranajes', nxt: 4, suelta: true, redonda: true },
  { clave: 'engranaje conico 36', dat: '32498', nombre: 'Engranaje doble cónico 36 dientes', w: 5, d: 1, alto: 12, studs: 'ninguna', cat: 'Engranajes', nxt: 2, suelta: true, redonda: true },
  { clave: 'rueda de mando', dat: '32072', nombre: 'Rueda de mando (knob)', w: 3, d: 1, alto: 7.5, studs: 'ninguna', cat: 'Engranajes', nxt: 4, suelta: true, redonda: true },
  // --- Ruedas y poleas del kit ---
  { clave: 'llanta nxt', dat: '56145', nombre: 'Llanta NXT 30×20 (6 rayos)', w: 4, d: 3, alto: 10, studs: 'ninguna', cat: 'Ruedas', nxt: 4, suelta: true, redonda: true, bbox: true },
  { clave: 'neumatico nxt', dat: '55976', nombre: 'Neumático todoterreno 56×26', w: 7, d: 3, alto: 18, studs: 'ninguna', cat: 'Ruedas', nxt: 4, suelta: true, redonda: true, bbox: true },
  { clave: 'llanta chica nxt', dat: '55981', nombre: 'Llanta 18×14 con agujeros', w: 2, d: 2, alto: 5, studs: 'ninguna', cat: 'Ruedas', nxt: 2, suelta: true, redonda: true, bbox: true },
  { clave: 'neumatico chico nxt', dat: '89201', nombre: 'Neumático bajo 24×14', w: 3, d: 2, alto: 8, studs: 'ninguna', cat: 'Ruedas', nxt: 2, suelta: true, redonda: true, bbox: true },
  { clave: 'polea', dat: '4185a', nombre: 'Polea (rueda de correa) 24', w: 3, d: 1, alto: 7.5, studs: 'ninguna', cat: 'Ruedas', nxt: 4, suelta: true, redonda: true },
  { clave: 'neumatico de polea', dat: '2815', nombre: 'Neumático de polea', w: 4, d: 1, alto: 9.5, studs: 'ninguna', cat: 'Ruedas', nxt: 4, suelta: true, redonda: true },
  // --- Electrónica NXT ---
  { clave: 'bloque nxt', dat: '53788', nombre: 'Bloque inteligente NXT', w: 9, d: 14, alto: 13, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 1, bbox: true },
  { clave: 'motor nxt', dat: '53787', nombre: 'Servomotor NXT', w: 5, d: 14, alto: 14, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 3, bbox: true },
  { clave: 'sensor ultrasonico', dat: '53792', nombre: 'Sensor ultrasónico NXT', w: 7, d: 5, alto: 10, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 1, bbox: true },
  { clave: 'sensor de contacto', dat: '53793', nombre: 'Sensor de contacto NXT', w: 3, d: 6, alto: 10, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 2, bbox: true },
  { clave: 'sensor de sonido', dat: '55963', nombre: 'Sensor de sonido NXT', w: 3, d: 5, alto: 10, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 1, bbox: true },
  { clave: 'sensor de luz', dat: '55969', nombre: 'Sensor de luz NXT', w: 3, d: 5, alto: 10, studs: 'ninguna', cat: 'Electrónica NXT', nxt: 1, bbox: true },
];

// Colores (códigos oficiales de LDraw / LDConfig.ldr + hex aproximado para la interfaz)
export const COLORES = [
  { clave: 'rojo', codigo: 4, nombre: 'Rojo', hex: '#C91A09' },
  { clave: 'azul', codigo: 1, nombre: 'Azul', hex: '#0055BF' },
  { clave: 'amarillo', codigo: 14, nombre: 'Amarillo', hex: '#F2CD37' },
  { clave: 'verde', codigo: 2, nombre: 'Verde', hex: '#237841' },
  { clave: 'verde claro', codigo: 10, nombre: 'Verde claro', hex: '#4B9F4A' },
  { clave: 'lima', codigo: 27, nombre: 'Lima', hex: '#BBE90B' },
  { clave: 'naranja', codigo: 25, nombre: 'Naranja', hex: '#FE8A18' },
  { clave: 'celeste', codigo: 9, nombre: 'Celeste', hex: '#B4D2E3' },
  { clave: 'rosa', codigo: 13, nombre: 'Rosa', hex: '#FC97AC' },
  { clave: 'violeta', codigo: 22, nombre: 'Violeta', hex: '#81007B' },
  { clave: 'blanco', codigo: 15, nombre: 'Blanco', hex: '#F4F4F4' },
  { clave: 'negro', codigo: 0, nombre: 'Negro', hex: '#1B2A34' },
  { clave: 'gris claro', codigo: 71, nombre: 'Gris claro', hex: '#A0A5A9' },
  { clave: 'gris oscuro', codigo: 72, nombre: 'Gris oscuro', hex: '#6C6E68' },
  { clave: 'marron', codigo: 70, nombre: 'Marrón', hex: '#582A12' },
  { clave: 'beige', codigo: 19, nombre: 'Beige', hex: '#E4CD9E' },
];

// --- Búsquedas ---

export function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/×/g, 'x')
    .trim();
}

// Sinónimos de la primera palabra (acepta inglés y variantes)
const SINONIMOS = {
  brick: 'ladrillo', bloque: 'ladrillo',
  plate: 'placa', plato: 'placa', chata: 'placa',
  tile: 'lisa', baldosa: 'lisa', azulejo: 'lisa',
  slope: 'pendiente', techo: 'pendiente', rampa: 'pendiente',
  wedge: 'cuna', 'cuña': 'cuna',
  axle: 'eje', technic: 'tecnico', 'técnico': 'tecnico', 'tecnica': 'tecnico',
  wheel: 'llanta', rueda: 'llanta', tire: 'neumatico', 'neumático': 'neumatico', goma: 'neumatico',
  cone: 'cono', round: 'redonda', bracket: 'soporte', arch: 'arco', panel: 'panel',
  grille: 'rejilla', headlight: 'faro', antenna: 'antena',
  beam: 'viga', liftarm: 'viga', barra: 'viga',
  gear: 'engranaje', engrane: 'engranaje', rueda_dentada: 'engranaje',
  bush: 'buje', worm: 'tornillo', motor: 'motor', sensor: 'sensor', ladrillo_nxt: 'bloque',
};

const porClave = new Map(PIEZAS.map(p => [p.clave, p]));
const porDat = new Map(PIEZAS.map(p => [p.dat, p]));

export function buscarPieza(nombre) {
  let n = normalizarTexto(nombre);
  if (porClave.has(n)) return porClave.get(n);
  // probar sinónimo en la primera palabra
  const palabras = n.split(' ');
  if (SINONIMOS[palabras[0]]) {
    palabras[0] = SINONIMOS[palabras[0]];
    n = palabras.join(' ');
    if (porClave.has(n)) return porClave.get(n);
  }
  // "2x4 ladrillo" → "ladrillo 2x4"
  if (palabras.length === 2 && /^\d+x\d+$/.test(palabras[0])) {
    const alReves = palabras[1] + ' ' + palabras[0];
    if (porClave.has(alReves)) return porClave.get(alReves);
  }
  // por número de pieza LDraw
  if (porDat.has(n)) return porDat.get(n);
  return null;
}

const colorPorClave = new Map(COLORES.map(c => [c.clave, c]));
const colorPorCodigo = new Map(COLORES.map(c => [c.codigo, c]));
const SINONIMOS_COLOR = {
  red: 'rojo', blue: 'azul', yellow: 'amarillo', green: 'verde', orange: 'naranja',
  white: 'blanco', black: 'negro', pink: 'rosa', purple: 'violeta', morado: 'violeta',
  lila: 'violeta', brown: 'marron', 'marrón': 'marron', tan: 'beige', crema: 'beige',
  gris: 'gris claro', gray: 'gris claro', grey: 'gris claro', lime: 'lima',
  'azul claro': 'celeste', cian: 'celeste',
};

export function buscarColor(nombre) {
  let n = normalizarTexto(nombre);
  if (colorPorClave.has(n)) return colorPorClave.get(n);
  if (SINONIMOS_COLOR[n]) return colorPorClave.get(SINONIMOS_COLOR[n]);
  if (/^\d+$/.test(n) && colorPorCodigo.has(Number(n))) return colorPorCodigo.get(Number(n));
  return null;
}

export function piezaPorClave(clave) { return porClave.get(clave) || null; }

// Pieza del catálogo por número de archivo LDraw (ej: "3001" → ladrillo 2x4).
// La usa el importador de modelos .ldr/.mpd para reconocer las piezas del
// archivo y convertirlas en piezas editables de la guía.
export function piezaPorDat(dat) {
  return porDat.get(normalizarDat(dat)) || null;
}

export function normalizarDat(dat) {
  return String(dat || '').toLowerCase().replace(/\.dat$/, '');
}

// ============================================================
// Piezas importadas: el catálogo que crece solo
//
// Un modelo .ldr puede traer piezas que no están en este catálogo. En vez de
// dejarlas como líneas LDraw intocables, el importador las mide y las registra
// acá al vuelo, con su tamaño real en studs y placas. Desde ese momento son
// piezas como cualquier otra: se ubican en la cuadrícula, se editan en el 3D,
// se cuentan en el inventario y salen en las fichas.
// ============================================================

export const CAT_IMPORTADAS = 'Importadas';

export function clavePiezaImportada(dat) {
  return 'ldraw ' + normalizarDat(dat);
}

export function registrarPiezaImportada(datos) {
  const dat = normalizarDat(datos && datos.dat);
  if (!dat) return null;
  const yaEstaba = porDat.get(dat);
  if (yaEstaba && !yaEstaba.importada) return yaEstaba;   // es una pieza del catálogo de siempre
  const clave = clavePiezaImportada(dat);
  if (porClave.has(clave)) return porClave.get(clave);
  const info = {
    clave,
    dat,
    nombre: datos.nombre || ('Pieza LDraw ' + dat),
    w: Math.max(1, Math.round(datos.w || 1)),
    d: Math.max(1, Math.round(datos.d || 1)),
    alto: Math.max(1, Math.round(datos.alto || 1)),
    studs: 'ninguna',
    cat: CAT_IMPORTADAS,
    bbox: true,          // se ubica por su caja medida, no por la huella de studs
    importada: true,
  };
  PIEZAS.push(info);
  porClave.set(clave, info);
  if (!porDat.has(dat)) porDat.set(dat, info);
  if (!CATEGORIAS.includes(CAT_IMPORTADAS)) CATEGORIAS.push(CAT_IMPORTADAS);
  return info;
}

export function piezasImportadas() {
  return PIEZAS.filter(p => p.importada);
}
export function colorPorCodigoLdraw(codigo) { return colorPorCodigo.get(Number(codigo)) || null; }

// --- Kits: filtro de piezas disponibles ---

// ¿La pieza pertenece al kit? (kit 'todas' o vacío = sin restricción)
export function piezaEnKit(pieza, kit) {
  if (!kit || kit === 'todas') return true;
  return !!(pieza && pieza[kit]);
}

// Piezas de un kit (para selects, prompt y validaciones)
export function piezasDeKit(kit) {
  if (!kit || kit === 'todas') return PIEZAS;
  return PIEZAS.filter(p => p[kit]);
}

// Cantidad disponible de una pieza con N kits (null = sin límite)
export function cantidadEnKit(pieza, kit, cantidadKits) {
  if (!kit || kit === 'todas' || !cantidadKits) return null;
  if (!pieza || !pieza[kit]) return 0;
  return pieza[kit] * cantidadKits;
}

// ============================================================
// Base de datos de CONECTORES: qué tiene cada pieza para unirse.
//   st = studs arriba          tu = tubos abajo (recibe studs)
//   ap = agujero de pin        ac = agujero en cruz (recibe eje)
//   pi = pin macho             ej = eje macho
//   nl = neumático (se monta sobre una llanta)
// Las únicas uniones físicas válidas: st↔tu · pi↔ap · ej↔ac · nl↔llanta.
// ============================================================

const CONECTORES_CATEGORIA = {
  Ladrillos: 'st tu',
  Placas: 'st tu',
  Lisas: 'tu',
  Pendientes: 'st tu',
  Redondas: 'st tu',
  'Técnicas': 'st tu ap',
  'Vigas NXT': 'ap ac',
  Engranajes: 'ac',
  Ruedas: 'ac',
  'Electrónica NXT': 'ap',
  Especiales: 'st tu',
};

const CONECTORES_PIEZA = {
  // ejes y pines
  'eje 2': 'ej', 'eje 3': 'ej', 'eje 4': 'ej', 'eje 5': 'ej', 'eje 6': 'ej',
  'eje 8': 'ej', 'eje 10': 'ej', 'eje 12': 'ej', 'eje con tope': 'ej', 'eje 2 con muesca': 'ej',
  'pin': 'pi', 'pin largo': 'pi', 'pin liso': 'pi', 'pin con tope': 'pi',
  'medio pin': 'pi st', 'pin eje': 'pi ej', 'pin eje beige': 'pi ej', 'pin doble con cruz': 'pi ac',
  // conectores con agujero en cruz
  'buje': 'ac', 'medio buje': 'ac', 'acople de ejes': 'ac', 'acople de ejes liso': 'ac', 'conector recto': 'ac',
  'bloque cruz 1x2': 'ap ac', 'bloque cruz 1x3': 'ap ac', 'bloque cruz doble': 'ac',
  'bloque cruz 2x2': 'pi ac',
  'ladrillo con cruz': 'st tu ac',
  // vigas con pines propios
  'viga 3 con pines': 'pi ap', 'viga angular con pines': 'pi ap', 'brazo de direccion 3': 'pi ap',
  // ruedas
  'llanta nxt': 'ac', 'llanta chica nxt': 'ac', 'polea': 'ac', 'rueda de mando': 'ac', 'tornillo sin fin': 'ac',
  'neumatico nxt': 'nl', 'neumatico chico nxt': 'nl', 'neumatico de polea': 'nl',
  'llanta chica': 'ap', 'neumatico chico': 'nl', 'llanta mediana': 'ap', 'neumatico mediano': 'nl',
  'placa con ruedas 2x2': 'st tu pi', 'placa con ruedas 1x4': 'st tu pi',
  // electrónica: el motor además recibe un eje en su cubo naranja
  'motor nxt': 'ap ac',
};

const NOMBRES_CONECTORES = {
  st: 'studs arriba', tu: 'tubos abajo (recibe studs)', ap: 'agujeros de pin',
  ac: 'agujero en cruz (recibe eje)', pi: 'pin macho', ej: 'eje macho', nl: 'neumático (va sobre llanta)',
};

export function conectoresDe(pieza) {
  if (!pieza) return new Set();
  const codigos = CONECTORES_PIEZA[pieza.clave] || CONECTORES_CATEGORIA[pieza.cat] || '';
  return new Set(codigos.split(' ').filter(Boolean));
}

export function conectoresLegibles(pieza) {
  return [...conectoresDe(pieza)].map(c => NOMBRES_CONECTORES[c] || c).join(', ') || 'ninguno';
}
