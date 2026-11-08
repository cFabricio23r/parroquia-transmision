# Guía del `config.json` de una parroquia

Esta guía es para quien escribe el `config.json` **a mano**, hasta que exista el editor. Cada parroquia tiene su carpeta (`vicaria/<slug>/`) con su `config.json` y su carpeta `medios/` (logos, fachada, fotos). El ejemplo completo está en `vicaria/san-jose-ejemplo/config.json`: copiarlo y cambiar los datos es la forma más segura de empezar.

Esta guía no es parte de las pantallas: está en el repositorio solo como guía para quien edita el archivo.

## Reglas de oro

1. **Todo lo de la segunda parte es opcional.** Si un bloque no está, la pantalla se ve «como viene» (igual que antes). La parroquia de Ciudad Arce no tiene ninguno y por eso se ve exactamente como siempre.
2. **Si el archivo tiene un error, no se usa.** Las pantallas siguen con la última configuración buena que ya tenían guardada (o con pantallas neutras si nunca tuvieron una). Se ve el error en español en el panel. Antes de publicar, abra el panel de la parroquia y revise que no avise de errores.
3. **Después de cambiar algo, suba el número de `version`** (ver «Cómo publicar un cambio»). Sin una `version` nueva, las pantallas que ya tienen una copia guardada **no se enteran** del cambio.
4. **Todo texto es texto plano.** No se usa HTML. Los textos de los bloques opcionales (segunda parte) admiten hasta 200 caracteres: si uno se pasa, **se rechaza el archivo** (no se corta). Sin límite de largo: `nombre`, `nombreCorto`, `lugar`, `patrono.nombre`, `patrono.corto`, `fiesta.lema` y los `alt` de `logos`, `fachada` y `patrono.imagen`.
5. **Toda imagen lleva `alt`** (la descripción para quien no ve la imagen). Es obligatorio.
6. **Rutas de imagen:** solo `medios/nombre.ext` (sin subcarpetas) y con extensión `png`, `jpg`, `jpeg`, `webp` o `svg`. No se aceptan `http://`, `https://`, `//`, `..` ni `\`. El nombre solo puede llevar letras, números, punto, guion y guion bajo.
7. **Colores:** siempre `#rrggbb` (por ejemplo `#8a1c2b`). Todo color sobre el que va texto blanco debe tener contraste de al menos 4.5 a 1 con el blanco; si es muy claro, se rechaza.
8. **`id` y `clave`:** de 2 a 40 caracteres, solo minúsculas, números y guiones sueltos (`hora-misionera` sí; `Hora_Misionera` y `-hora` no).
9. **Fechas:** `AAAA-MM-DD` y que existan (`2026-02-30` se rechaza).

## Cómo publicar un cambio (la `version`)

Cada pantalla y cada panel guarda una **copia** de la última configuración que recibió. Cuando abre, pregunta al servidor por `config.json` y compara solo el número `version`: si es **distinto** de la copia, adopta la nueva; si es **igual**, sigue con la copia aunque el archivo haya cambiado.

Para publicar un cambio:

1. Edite `config.json`.
2. Suba `version` en 1 (de `2` a `3`). Es un número entero desde 1, sin comillas.
3. Cambie `publicado` a la fecha y hora de hoy (por ejemplo `"2026-11-08T12:00:00Z"`).
4. Despliegue. Las pantallas lo toman en uno o dos minutos, sin recargar.

Los cambios sin una `version` nueva **no llegan** a las pantallas que ya tienen su copia guardada.

## Primera parte: lo obligatorio

```json
{
  "esquema": 1,
  "version": 2,
  "publicado": "2026-11-08T12:00:00Z",
  "slug": "san-jose-ejemplo",
  "nombre": "Parroquia San José (ejemplo)",
  "nombreCorto": "San José",
  "lugar": "Ciudad de ejemplo",
  "colores": { "principal": "#8a1c2b", "oscuro": "#4b0f18" },
  "logos": {
    "blanco": { "src": "medios/logo-blanco.svg", "alt": "Logo de ejemplo, en blanco" },
    "color": { "src": "medios/logo-color.png", "alt": "Logo de ejemplo, a color" }
  },
  "fachada": { "src": "medios/fachada.svg", "alt": "Dibujo de ejemplo de la fachada de un templo" },
  "patrono": {
    "nombre": "San José",
    "corto": "San José",
    "imagen": { "src": "medios/patrono.png", "alt": "Imagen de San José" }
  },
  "fiesta": { "dia": 19, "mes": 3, "lema": "ITE AD IOSEPH", "cuentaDesdeDias": 60 }
}
```

| Campo | Qué es | Valores y límites |
|---|---|---|
| `esquema` | Versión del formato | Siempre `1`. |
| `version` | Número de publicación | Entero desde 1. Se sube en cada cambio. |
| `publicado` | Fecha de publicación | Fecha y hora válidas (ISO). |
| `slug` | Nombre de la carpeta y del link | De 2 a 40 caracteres, con la forma `^[a-z0-9]+(-[a-z0-9]+)*$` (minúsculas, números y guiones sueltos). Debe ser igual al de la carpeta y al de la dirección de la página. |
| `nombre` | Nombre completo | Texto, no vacío. |
| `nombreCorto` | Nombre corto | Opcional; si está, no puede estar vacío. |
| `lugar` | Ciudad o población | Texto, no vacío. |
| `colores.principal`, `colores.oscuro` | Los dos colores de la parroquia | `#rrggbb`, contraste con blanco de 4.5 o más. |
| `logos.blanco` | Logo para fondos de color | Obligatorio: `{ "src", "alt" }`. |
| `logos.color` | Logo a color | Opcional: `{ "src", "alt" }`. |
| `fachada` | Foto o dibujo del templo | Obligatorio: `{ "src", "alt" }`. |
| `patrono.nombre`, `patrono.corto` | Nombre del patrono y su forma corta | Texto, no vacío. |
| `patrono.imagen` | Imagen del patrono | Opcional: `{ "src", "alt" }`. |
| `fiesta.dia`, `fiesta.mes` | Fecha de la fiesta patronal | Día que exista en ese mes; mes de 1 a 12. |
| `fiesta.lema` | Frase de la fiesta | Opcional; texto. Sin lema no hay franja. |
| `fiesta.cuentaDesdeDias` | Desde cuántos días antes cuenta regresiva | Opcional; entero desde 1 (por defecto 60). |

## Segunda parte: los bloques opcionales

Todos son opcionales e independientes. Si un bloque está mal escrito, **todo el archivo se rechaza** (con un mensaje que nombra el campo).

### `galeria`: imágenes extra (hasta 30)

Imágenes que luego se eligen por su `id` en pantallas y tipos propios.

```json
"galeria": [
  {
    "id": "taller",
    "src": "medios/taller.svg",
    "alt": "Dibujo de ejemplo de una escuadra, un martillo y un lirio",
    "etiquetas": ["patrono", "ejemplo"]
  }
]
```

| Campo | Valores y límites |
|---|---|
| `id` | Obligatorio, único; de 2 a 40, minúsculas, números y guiones. |
| `src` | Obligatorio: `medios/archivo.ext` (ver reglas de rutas). |
| `alt` | Obligatorio, hasta 200 caracteres. |
| `etiquetas` | Opcional; hasta 10 textos de hasta 200 caracteres. |

El panel ofrece cada imagen de la galería como opción de imagen, con su `alt` como nombre.

### `pantallas`: personalizar cada pantalla

Las vistas se llaman `inicio`, `portada`, `gracias`, `avisos` y `horarios` (esta última se abre con `?tipo=horarios`). Solo se escribe la que se quiere cambiar.

> El ejemplo de abajo usa `galeria:taller`: funciona solo si el archivo también tiene la imagen `taller` en `galeria` (ver el ejemplo de `galeria` de arriba). Si no, el archivo se rechaza.

```json
"pantallas": {
  "inicio": {
    "modo": "personalizada",
    "fondo": { "tipo": "color", "color": "#6b1523" },
    "imagen": "galeria:taller",
    "distribucion": "derecha",
    "ocultar": ["chispas"],
    "textos": { "inicio_cursiva": "Bienvenidos a {parroquia}" }
  },
  "portada": { "modo": "como-viene" }
}
```

| Campo | Valores y límites |
|---|---|
| `modo` | `como-viene` (por defecto: la pantalla se ve como siempre y **el resto del bloque no se aplica**) o `personalizada`. |
| `fondo.tipo` | **Obligatorio siempre que haya `fondo`**: `degradado` (el de siempre), `color` o `imagen`. Un `fondo` sin `tipo` rechaza el archivo con «El tipo de fondo (pantallas.inicio.fondo.tipo) debe ser uno de: degradado, color, imagen.» |
| `fondo.color` | `#rrggbb` con contraste con blanco de 4.5 o más. Obligatorio si el tipo es `color`. |
| `fondo.imagen` | `id` de una imagen de la `galeria`. Obligatorio si el tipo es `imagen`. |
| `imagen` | La imagen grande de la pantalla: `automatica` (la de siempre, según la transmisión), `patrono`, `fachada`, `logo`, `custodia`, `santo`, `ninguna`, o `galeria:<id>` con un `id` existente. |
| `distribucion` | Dónde va la imagen: `izquierda` (por defecto), `derecha` o `centro`. El texto ocupa el otro lado. |
| `ocultar` | Lista de elementos a ocultar: `marca`, `envivo`, `chispas`, `rayos`, `fachada`, `franja`, `esquina`. **El título nunca se oculta**: la pantalla no queda en blanco. |
| `textos` | Objeto `clave: texto` (hasta 200 caracteres). Claves válidas más abajo. |

Aunque el `modo` sea `como-viene`, el bloque **se valida igual**: un campo mal escrito rechaza el archivo. Igual con `fondo.color` y `fondo.imagen`: se validan siempre que estén escritos, aunque `fondo.tipo` sea otro (un `color` mal escrito o una `imagen` que no está en la galería rechaza el archivo aunque el tipo sea `degradado`).

Si una imagen de la galería ya no existe, la pantalla usa la automática (o el degradado, en un fondo). Una imagen que no carga se oculta sin dejar el ícono roto.

#### Claves de `textos`

`marca`, `inicio_pildora`, `inicio_ceja`, `inicio_titulo`, `inicio_cursiva`, `inicio_cuenta`, `portada_ceja`, `portada_cursiva`, `portada_titulo`, `portada_fecha`, `portada_sub`, `gracias_pildora`, `gracias_titulo`, `gracias_cursiva`, `gracias_ceja`, `avisos_sub`, `avisos_titulo`, `horarios_titulo`, `capa_logo`, `barra_y`, `franja`, `k_lectura1`, `k_salmo`, `k_lectura2`, `k_evangelio`, `k_rosario`, `t_rosario`.

Un texto puede llevar huecos que se rellenan solos con los datos de la parroquia: `{parroquia}`, `{patrono}`, `{patronoCorto}`, `{fiesta}`, `{fiestaMayus}`, `{lema}` y `{anio}`. Un salto de línea se escribe `\n`.

**Qué texto gana:** primero lo que se escribe en el panel; si no hay, lo de la configuración; si no hay, el texto automático de siempre.

### `rotulos`: estilo de los rótulos

```json
"rotulos": {
  "tipografia": "montserrat",
  "esquinas": "rectas",
  "posicion": "izquierda",
  "colorLado": "#4b0f18",
  "cargos": ["CELEBRANTE", "PREDICADOR", "DIÁCONO", "LECTOR", "MONAGUILLO"]
}
```

| Campo | Valores y límites |
|---|---|
| `tipografia` | Solo `montserrat` (la única fuente local que hay). |
| `esquinas` | `redondeadas` (por defecto) o `rectas`. |
| `posicion` | `izquierda` (por defecto) o `centro`. |
| `colorLado` | `#rrggbb` con contraste con blanco de 4.5 o más. Sin él, se usa el degradado de la paleta. |
| `cargos` | Hasta 12 textos (no vacíos, hasta 200 caracteres) que reemplazan la lista sugerida de cargos del panel. |

### `tipos`: tipos de transmisión

> El ejemplo usa `galeria:taller`: necesita la imagen `taller` en `galeria` (ver el ejemplo de `galeria`). Si no está, el archivo se rechaza.

```json
"tipos": {
  "apagados": ["procesion"],
  "propios": [
    {
      "clave": "misa-de-ninos",
      "nombre": "Misa de niños",
      "descripcion": "Misa familiar de {parroquia} con los niños.",
      "titulo": "MISA DE NIÑOS",
      "ceja": "EN HONOR A {patronoCorto}",
      "cursiva": "Dejen que los niños vengan a mí",
      "franja": "Venid, niños, a la casa del Señor",
      "imagen": "galeria:taller",
      "esquina": "hoy",
      "rotulos": ["persona", "lectura1", "evangelio"]
    }
  ]
}
```

| Campo | Valores y límites |
|---|---|
| `apagados` | Claves de tipos comunes que el panel no ofrece: `dominical`, `semana`, `horasanta`, `sector`, `patronalsector`, `procesion`, `otros`, `prenovena`, `novena`, `patronal`, `evento`. Debe quedar al menos un tipo disponible (común o propio). |
| `propios` | Hasta 10 tipos nuevos, que aparecen al final de la lista del panel en el orden escrito. |
| `propios[].clave` | Obligatoria, única; 2 a 40, minúsculas, números y guiones; **no puede ser la de un tipo común**. |
| `propios[].nombre` | Obligatorio; hasta 200 caracteres. |
| `descripcion`, `titulo`, `ceja`, `cursiva`, `franja`, `esquinaTexto` | Opcionales; hasta 200 caracteres; admiten los huecos de arriba. |
| `imagen` | `patrono` (por defecto), `fachada`, `logo`, `custodia`, `santo`, `ninguna` o `galeria:<id>`. (`automatica` no aplica aquí.) |
| `esquina` | Qué va en la esquina: `hoy` (por defecto), `fecha`, `fiesta` o `texto` (el de `esquinaTexto`). |
| `rotulos` | Hasta 10 rótulos del panel, elegidos entre: `persona`, `lectura1`, `lectura2`, `salmo`, `evangelio`, `rosario`, `santisimo`, `lugar`, `oracion`, `libre`. |

Lo que un tipo propio no dice, queda así: `titulo` = su `nombre`; `ceja` = `{parroquia}` (nombre de la parroquia y su lugar, «nombre · lugar»); `cursiva` en blanco; `franja` = el lema de la fiesta entre comillas; `imagen` = `patrono`; `esquina` = `hoy`. Un tipo propio no tiene cuenta regresiva ni portada. Si un tipo propio se borra de la configuración y alguien lo tenía elegido, el panel y la pantalla pasan al primer tipo disponible, sin error.

### `horarios`: horarios de misa (hasta 12)

Se ven en la pantalla `?tipo=horarios`.

```json
"horarios": [
  { "dia": "Sábado", "hora": "6:00 p. m.", "nota": "Misa de vigilia" },
  { "dia": "Domingo", "hora": "7:00 a. m." }
]
```

| Campo | Valores y límites |
|---|---|
| `dia` | Obligatorio; hasta 200 caracteres. |
| `hora` | Obligatorio; hasta 200 caracteres. |
| `nota` | Opcional; hasta 200 caracteres. |

Sin horarios ni redes, esa pantalla dice «Consulte los horarios en el panel».

### `redes`: redes sociales (hasta 6)

Se ven debajo de los horarios.

```json
"redes": [
  { "red": "facebook", "url": "https://www.facebook.com/ejemplo", "texto": "/ParroquiaEjemplo" }
]
```

| Campo | Valores y límites |
|---|---|
| `red` | `facebook`, `youtube`, `instagram`, `whatsapp` o `web`. |
| `url` | Debe empezar con `https://`. **Solo se valida: en pantalla nunca se ve** (OBS no hace clic). |
| `texto` | Lo que se ve en pantalla (por ejemplo `/ParroquiaEjemplo`). Obligatorio; hasta 200 caracteres. |

### `avisos`: avisos fijos (hasta 10)

Se ven en la pantalla de avisos, **antes** de los que se escriben en el panel. Entre fijos y del panel se muestran como máximo 6 filas.

```json
"avisos": [
  { "texto": "Ensayo del coro", "detalle": "Jueves · 7:00 p. m.", "orden": 1 },
  { "texto": "Colecta para el techo", "detalle": "Hasta fin de año", "desde": "2026-11-01", "hasta": "2026-12-31", "orden": 2 }
]
```

| Campo | Valores y límites |
|---|---|
| `texto` | Obligatorio; hasta 200 caracteres. |
| `detalle` | Opcional; hasta 200 caracteres. |
| `desde`, `hasta` | Opcionales, `AAAA-MM-DD`. El aviso se ve desde el día `desde` hasta el día `hasta`, **ambos inclusive** (hora local de la pantalla). `desde` no puede ser posterior a `hasta`. Sin fechas, siempre se ve. |
| `orden` | Opcional; número entero. Va primero el menor; si empatan, el que está antes en la lista. |

## Antes de publicar: lista de revisión

- [ ] `version` subió y `publicado` es de hoy.
- [ ] `slug` es igual al nombre de la carpeta.
- [ ] Todas las imágenes existen en `medios/` y tienen `alt`.
- [ ] Los colores se leen con texto blanco.
- [ ] El panel de la parroquia abre sin avisos de error.
