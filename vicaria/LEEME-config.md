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
7. **Colores:** siempre `#rrggbb` (por ejemplo `#8a1c2b`). Todo color sobre el que va texto blanco debe tener contraste de al menos 4.5 a 1 con el blanco; si es muy claro, se rechaza. Las excepciones son `colores.acento`, `rotulos.colorLado` y `rotulos.colorLinea`, que no llevan texto blanco encima y no exigen contraste.
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
| `colores.acento` | Opcional: tercer color (dorado, por ejemplo) para filetes y líneas | `#rrggbb`. No exige contraste. Los rótulos pueden pedirlo por su nombre: `acento`. En las pantallas pinta la línea de la franja del lema (con un tono más claro del mismo acento al centro, que se calcula solo), sus adornos (✦) y el filete de la caja de horarios y redes. Sin él, la franja usa los colores de la paleta. |
| `logos.blanco` | Logo para fondos de color | Obligatorio: `{ "src", "alt" }`. |
| `logos.color` | Logo a color | Opcional: `{ "src", "alt" }`. Solo lo usa el lateral claro de los rótulos (`rotulos.colorLado`); Avisos, Horarios y Producción usan el blanco, dentro de un círculo del color principal. |
| `fachada` | Foto o dibujo del templo | Obligatorio: `{ "src", "alt" }`. |
| `patrono.nombre`, `patrono.corto` | Nombre del patrono y su forma corta | Texto, no vacío. |
| `patrono.imagen` | Imagen del patrono | Opcional: `{ "src", "alt" }`. |
| `fiesta.dia`, `fiesta.mes` | Fecha de la fiesta patronal | Día que exista en ese mes; mes de 1 a 12. |
| `fiesta.lema` | Frase de la fiesta | Opcional; texto. Sin lema no hay franja. |
| `fiesta.cuentaDesdeDias` | Desde cuántos días antes cuenta regresiva | Opcional; entero desde 1 (por defecto 60). |

### Colores que salen de la paleta

La parroquia escribe solo `colores.principal`, `colores.oscuro` y, si quiere, `colores.acento`. Los demás colores de las pantallas, los rótulos y la producción **se calculan solos** a partir de ellos, con el mismo tratamiento que el diseño da a la identidad vino: se toma cada color del diseño, se le aplica el tono y la saturación del principal de la parroquia y se conserva su claridad. No se escriben en el `config.json`.

| Color | Dónde se ve | Con la identidad vino del diseño (principal `#8a1c2b`) |
|---|---|---|
| vivo | Final del degradado del fondo, el cargo del rótulo (kicker), el sub de Avisos y de Producción | `#c0485a` |
| tenue | Cejas, sub de la portada, días y redes de la caja de abajo, destello del título, rayas de Producción azul | `#f2d6da` |
| velo | Fondo de las filas de Avisos y Horarios, frase en cursiva, filete de las redes | `#fbeef0` |
| tinta | Ceja de Producción claro | `#3a2a2c` |
| gris | Pie de Producción claro | `#5a4a4c` |
| papel | Fondo de Producción claro | `#faf6f3` |
| texto de fila | Detalle de las filas (día y hora) | el principal (`#8a1c2b`) |
| acento claro | Centro de la línea de la franja (solo con `colores.acento`) | `#f0d08f` con acento `#d9a441` |

Dos cuidados de lectura se aplican solos: el «vivo» se oscurece lo necesario para leerse sobre blanco (4.5 a 1), y si el principal no se lee sobre el fondo de las filas, el detalle de las filas usa el color oscuro.

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
    "nombre": "Taller de San José",
    "etiquetas": ["patrono", "ejemplo"]
  }
]
```

| Campo | Valores y límites |
|---|---|
| `id` | Obligatorio, único; de 2 a 40, minúsculas, números y guiones. |
| `src` | Obligatorio: `medios/archivo.ext` (ver reglas de rutas). |
| `alt` | Obligatorio, hasta 200 caracteres. |
| `nombre` | Opcional; texto corto de hasta 200 caracteres para reconocer la imagen. |
| `etiquetas` | Opcional; hasta 10 textos de hasta 200 caracteres. |

El panel ofrece cada imagen de la galería como opción de imagen, con su `nombre`; si no tiene, con su `alt`.

### `pantallas`: personalizar cada pantalla

Las vistas se llaman `inicio`, `portada`, `gracias`, `avisos`, `horarios` (esta última se abre con `?tipo=horarios`), `evento`, `produccion` y `envivo`. Solo se escribe la que se quiere cambiar. `evento` es la portada (`?tipo=portada`) cuando el tipo elegido trae la portada de evento: ahí manda el bloque `evento`, no el de `portada`. Si la configuración no trae el bloque `evento`, esa portada usa el de `portada`, como antes de que existiera `evento` (una portada ya personalizada se sigue viendo igual). El título de la portada de evento es el nombre del evento escrito en el panel; si está vacío, el título del tipo.

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
| `ocultar` | Lista de elementos a ocultar: `marca`, `envivo`, `chispas`, `rayos`, `fachada`, `franja`, `esquina`, `cuenta`. **El título nunca se oculta**: la pantalla no queda en blanco. `chispas`, `rayos` y `fachada` (la silueta del templo) siguen valiendo, pero ya no cambian nada: el diseño no los dibuja (ver «Cómo se ve cada pantalla»). |
| `mostrar` | Lista opcional de elementos que se piden a propósito (lo contrario de `ocultar`): `redes`, `horarios`. Sin `mostrar` (o con `modo` `como-viene`) no se muestran: la pantalla se ve como siempre. En `avisos`, `horarios` agrega las filas de horarios después de los avisos (día y notas, y las horas), siempre dentro del máximo de 6 filas, y `redes` pone las redes debajo de las filas. En `inicio` y `gracias`, los horarios y las redes van en una caja debajo del texto, sin tapar la franja ni sacar el título del cuadro: en `gracias` van como mucho 6 filas de horarios; si aun así no caben, la caja se achica y deja fuera horarios desde el final (y, solo con textos muy largos, redes). En `avisos`, con `redes` las filas y las redes van más compactas para caber en la tarjeta. Un elemento que no está en esa lista, como `logo`, rechaza el archivo con «Ese elemento no se puede mostrar (pantallas.inicio.mostrar[0]): solo redes, horarios.». |
| `textos` | Objeto `clave: texto` (hasta 200 caracteres). Claves válidas más abajo. |

En `produccion` y `envivo` se aceptan `fondo`, `imagen` y `distribucion`, pero no se aplican: ahí solo cuentan `ocultar` y `textos`.

- `envivo` es la capa de `rotulos.html` (el logo de la esquina, el EN VIVO y la barra). `ocultar: ["marca"]` esconde el logo de la esquina y `ocultar: ["envivo"]` el cartel EN VIVO, aunque el panel los tenga prendidos. Sus textos son `capa_logo` (el nombre junto al logo) y `barra_y` (la segunda parte de la barra).
- `produccion` es `produccion.html`. `ocultar: ["marca"]` esconde el logo. Sus textos son `prod_ceja` y `prod_nombre`, y van **tal cual**: ahí los huecos `{…}` no se rellenan.

Aunque el `modo` sea `como-viene`, el bloque **se valida igual**: un campo mal escrito rechaza el archivo. Igual con `fondo.color` y `fondo.imagen`: se validan siempre que estén escritos, aunque `fondo.tipo` sea otro (un `color` mal escrito o una `imagen` que no está en la galería rechaza el archivo aunque el tipo sea `degradado`).

Si una imagen de la galería ya no existe, la pantalla usa la automática (o el degradado, en un fondo). Una imagen que no carga se oculta sin dejar el ícono roto.

#### Cómo se ve cada pantalla

- **Fondo:** un degradado diagonal liso de los colores de la parroquia (oscuro → principal → vivo) con un brillo suave arriba a la izquierda. La silueta del templo, los rayos y las chispas de antes ya no se ven, y ninguna opción los vuelve a prender. Para una foto de fondo se usa `fondo: { "tipo": "imagen", … }`.
- **Imagen grande:** va en un marco de arco (redondo arriba, esquinas suaves abajo) que baja hasta la franja; la imagen llena el arco y se recorta lo que sobra. El arco tiene un relleno oscuro suave (el del diseño): con una foto no se ve, y con un recorte sin fondo (un PNG transparente, como la Virgen de Ciudad Arce) queda detrás de la figura y deja ver la forma del arco. El logo (`imagen: "logo"`) no va en el arco ni lleva relleno.
- **Marca** (arriba a la izquierda): el logo y, al lado, el nombre y el lugar de la parroquia en dos líneas. La capa del logo de `rotulos.html` también los pone en dos líneas.
- **Gracias:** no muestra el cartel EN VIVO (la transmisión ya terminó).
- **Avisos y Horarios:** el logo blanco va en un círculo del color principal, junto al EN VIVO; las filas se reparten en la tarjeta. El logo cabe en el círculo sea cual sea su forma (cuadrado, 56 px; apaisado, hasta 60 px de ancho). Si la parroquia no tiene logo, o no carga, no queda el círculo vacío. En Avisos, el detalle de cada fila («Sábado · 9:00 a. m.») ocupa lo que mide, hasta 420 px; una dirección larga sin espacios se parte en dos líneas. Si con avisos largos la tarjeta no cabe, la lista se compacta (y, con redes, después deja redes fuera desde el final).
- **Producción claro:** el logo blanco en un círculo del color principal, a la izquierda del texto, y todo el grupo centrado. `ocultar: ["marca"]` quita el círculo y el texto queda centrado.

#### Claves de `textos`

`marca`, `inicio_pildora`, `inicio_ceja`, `inicio_titulo`, `inicio_cursiva`, `inicio_cuenta`, `portada_ceja`, `portada_cursiva`, `portada_titulo`, `portada_fecha`, `portada_sub`, `gracias_pildora`, `gracias_titulo`, `gracias_cursiva`, `gracias_ceja`, `avisos_sub`, `avisos_titulo`, `horarios_titulo`, `capa_logo`, `barra_y`, `franja`, `k_lectura1`, `k_salmo`, `k_lectura2`, `k_evangelio`, `k_rosario`, `t_rosario`, `prod_ceja`, `prod_nombre` (estas dos son de la pantalla `produccion`: «UNA PRODUCCIÓN DE» y «Comunicaciones» si no se escriben).

Un texto puede llevar huecos que se rellenan solos con los datos de la parroquia: `{parroquia}`, `{patrono}`, `{patronoCorto}`, `{fiesta}`, `{fiestaMayus}`, `{lema}` y `{anio}`. Un salto de línea se escribe `\n`.

**Qué texto gana:** primero lo que se escribe en el panel; si no hay, lo de la configuración; si no hay, el texto automático de siempre.

### `rotulos`: estilo de los rótulos

```json
"rotulos": {
  "tipografia": "montserrat",
  "esquinas": "rectas",
  "posicion": "izquierda",
  "colorLado": "#4b0f18",
  "colorLinea": "acento",
  "logoEsquina": true,
  "cargos": ["CELEBRANTE", "PREDICADOR", "DIÁCONO", "LECTOR", "MONAGUILLO"]
}
```

| Campo | Valores y límites |
|---|---|
| `tipografia` | `montserrat` (por defecto), `lora` o `source-sans`. |
| `esquinas` | `rectas`, `suaves` (por defecto: 24 px en el rótulo, 18 en la capa del logo y 16 en la barra) o `redondas` (valor provisional: 48, 36 y 32 px, hasta que el diseño lo confirme). **Valores de antes:** `redondeadas` sigue aceptado y se ve como `suaves` (mide lo mismo); un `suaves` escrito antes de este cambio también se ve a 24 px. |
| `posicion` | `izquierda` (por defecto) o `centro`. |
| `colorLado` | `#rrggbb` o un nombre: `principal`, `oscuro`, `acento` o `blanco`. No exige contraste con blanco. `acento` solo vale si existe `colores.acento`; si no, se rechaza con «El color (rotulos.colorLado) usa el acento, pero falta colores.acento.». Sin él, se usa el degradado de la paleta. Si el color es claro (contraste con blanco menor que 3, como `blanco`), en el lateral va el logo a color (`logos.color`), si existe. |
| `colorLinea` | `#rrggbb` o un nombre: `principal`, `oscuro` o `acento` (`blanco` no vale). Mismo aviso si pide `acento` y falta `colores.acento`. Sin él, la línea usa `colores.acento` si existe; si no, la de siempre. |
| `logoEsquina` | Opcional; `true` (por defecto) o `false`. Mientras hay un rótulo, la capa del logo (con su caja y el nombre) se aparta; con `true` queda en la esquina el logo blanco solo, sin caja y un poco transparente. Con `false` no queda nada. |
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
| `ajustes` | Objeto `clave del tipo común: ajustes` para cambiar un tipo que ya existe sin reemplazarlo. La clave debe ser un tipo común (la lista de `apagados`); un tipo desconocido, como `navidad`, rechaza el archivo («Ese tipo común no existe (tipos.ajustes.navidad).»). Los ajustes de un tipo apagado son válidos. Cada ajuste admite: `nombrePanel` (cómo se llama el tipo en el panel; no vacío, hasta 40 caracteres), `textoInicio` y `textoGracias` (hasta 200 caracteres; admiten los huecos de abajo), `imagen` (`patrono`, `fachada`, `logo`, `custodia`, `santo`, `ninguna` o `galeria:<id>`; `automatica` no aplica) y `ocultarRotulos` (ids de rótulos **de ese tipo** que el panel no ofrece; uno de otro tipo, como `santisimo` en `dominical`, rechaza el archivo). `textoInicio` reemplaza el título grande de Inicio y `textoGracias` la frase en cursiva de Gracias; ganan a los textos de `pantallas`, y lo escrito en el panel gana a los dos. Si la imagen `galeria:<id>` ya no está en la galería, se usa la imagen de siempre del tipo. Un rótulo oculto que estaba al aire deja de verse. |
| `propios` | Hasta 10 tipos nuevos, que aparecen al final de la lista del panel en el orden escrito. |
| `propios[].clave` | Obligatoria, única; 2 a 40, minúsculas, números y guiones; **no puede ser la de un tipo común**. |
| `propios[].nombre` | Obligatorio; hasta 200 caracteres. |
| `descripcion`, `titulo`, `ceja`, `cursiva`, `franja`, `esquinaTexto` | Opcionales; hasta 200 caracteres; admiten los huecos de arriba. |
| `imagen` | `patrono` (por defecto), `fachada`, `logo`, `custodia`, `santo`, `ninguna` o `galeria:<id>`. (`automatica` no aplica aquí.) |
| `esquina` | Qué va en la esquina: `hoy` (por defecto), `fecha`, `fiesta` o `texto` (el de `esquinaTexto`). |
| `nombrePanel`, `textoInicio`, `textoGracias` | Opcionales, con los mismos límites que en `ajustes` (`nombrePanel` hasta 40 caracteres; los otros dos hasta 200). |
| `portada` | Opcional: `ninguna` (por defecto), `fiesta` o `evento`. Con `fiesta` el tipo tiene la portada de la fiesta patronal, la cuenta regresiva a la fiesta y, si no dice otra `esquina`, la esquina `fiesta` (como la novena). Con `evento` tiene la portada de evento y el panel pide evento, fecha y lugar (como el tipo «Evento especial»). |
| `rotulos` | Hasta 10 rótulos del panel, elegidos entre: `persona`, `lectura1`, `lectura2`, `salmo`, `evangelio`, `rosario`, `santisimo`, `lugar`, `oracion`, `libre`. |
| `propios[].opcionales` | Ids de rótulos de este tipo que el panel no cuenta en "Faltan N datos". Sin esta lista, todos cuentan. Hasta 10; el id es la base (`lectura2`) o, si la base se repite, la base con su número (`persona-2`). |

Ejemplo de `ajustes` (Hora Santa con otro nombre y sin el rótulo de bendición):

```json
"tipos": {
  "ajustes": {
    "horasanta": { "nombrePanel": "Hora Santa", "textoInicio": "En breve comenzamos", "imagen": "custodia", "ocultarRotulos": ["bendicion"] }
  }
}
```

Los ids de rótulo de cada tipo común: `dominical`, `patronalsector` y `otros` tienen `persona`, `lectura1`, `salmo`, `lectura2`, `evangelio`; `semana`, `persona`, `lectura1`, `salmo`, `evangelio`; `horasanta`, `guia`, `santisimo`, `lectura1`, `oracion`, `bendicion`; `sector`, `persona`, `lugar`, `lectura1`, `salmo`, `evangelio`; `procesion`, `lugar`, `oracion`, `rosario`, `persona`; `prenovena`, `novena` y `patronal`, los de `dominical` más `rosario`; `evento`, `persona`, `libre`.

Lo que un tipo propio no dice, queda así: `titulo` = su `nombre`; `ceja` = `{parroquia}` (nombre de la parroquia y su lugar, «nombre · lugar»); `cursiva` en blanco; `franja` = el lema de la fiesta entre comillas; `imagen` = `patrono`; `esquina` = `hoy`; `nombrePanel` = su `nombre`. Sin `portada` (o con `ninguna`), un tipo propio no tiene cuenta regresiva ni portada. Si un tipo propio se borra de la configuración y alguien lo tenía elegido, el panel y la pantalla pasan al primer tipo disponible, sin error.

### `horarios`: horarios de misa (hasta 12)

Se ven en la pantalla `?tipo=horarios` (las horas del día juntas; al lado, el lugar y las notas) y, si la pantalla los pide con `mostrar`, en Avisos y Gracias. Cuando un día tiene varias horas, su píldora crece y las horas pasan a otra línea dentro de ella; con días de más de dos horas la lista se compacta. Los horarios de una sola hora se ven como siempre. Si la misma nota se repite en todas las horas de un día («Misa», «Misa»…), se escribe una sola vez. Si con lugares o notas largas la tarjeta no cabe, la pantalla la ajusta en este orden hasta que quepa: compacta la lista; corta el lugar y las notas con «…» (a tres líneas, o a una si hay dos columnas); achica las redes; deja el lugar y las notas en una línea más chica; y, solo si todavía no cabe, deja redes fuera desde el final. Los días y las horas no se quitan nunca. El texto cortado no avisa en el panel: conviene escribir lugares y notas cortos.

```json
"horarios": [
  { "dia": "Sábado", "hora": "6:00 p. m.", "nota": "Misa de vigilia" },
  { "dia": "Domingo", "hora": "7:00 a. m." },
  {
    "dia": "Domingo",
    "horas": [{ "hora": "9:00 a. m." }, { "hora": "6:00 p. m.", "nota": "Hora Santa" }],
    "lugar": "Templo parroquial"
  }
]
```

| Campo | Valores y límites |
|---|---|
| `dia` | Obligatorio; hasta 200 caracteres. |
| `hora` | Forma de una sola hora: obligatoria si no hay `horas`; hasta 200 caracteres. |
| `horas` | Forma de varias horas en el mismo día: de 1 a 6 entradas `{ "hora", "nota" }`; en cada una `hora` es obligatoria y `nota` opcional (hasta 200 caracteres). No se escribe junto con `hora`. |
| `nota` | Opcional; hasta 200 caracteres. |
| `lugar` | Opcional; hasta 200 caracteres. |

Las dos formas (`hora` y `horas`) pueden convivir en la misma lista.

Sin horarios ni redes, esa pantalla dice «Consulte los horarios en el panel».

### `redes`: redes sociales (hasta 6)

Se ven debajo de los horarios y, si la pantalla las pide con `mostrar`, en Inicio, Avisos y Gracias.

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
| `activo` | Opcional; `true` (por defecto) o `false`. Con `false` el aviso no se ve, aunque esté en fecha. |
| `desde`, `hasta` | Opcionales, `AAAA-MM-DD`. El aviso se ve desde el día `desde` hasta el día `hasta`, **ambos inclusive** (hora local de la pantalla). `desde` no puede ser posterior a `hasta`. Sin fechas, siempre se ve. |
| `orden` | Opcional; número entero. Va primero el menor; si empatan, el que está antes en la lista. |

## Vista previa del editor

El editor muestra las pantallas dentro de un `iframe` del mismo origen con `?vista-previa=1` (por ejemplo `pantalla.html?tipo=inicio&vista-previa=1` o `rotulos.html?vista-previa=1`). En ese modo la página no pide `config.json`: espera un mensaje (`postMessage`) de la ventana padre, del mismo origen:

```js
{ tipo: 'pev-vista-previa', config: { /* el borrador */ }, estado: { tipo: 'horasanta', rotulo: 'persona', celebrante: 'P. Juan Pérez' } }
```

- `config` es el borrador de la configuración; no se valida ni se guarda.
- `estado` es opcional: los campos del estado de la transmisión (tipo, rótulo al aire, textos…) que la vista previa debe mostrar. Ganan a lo guardado y nunca se escriben en el almacenamiento. Si no es un objeto, se ignora. Cada mensaje reemplaza el estado del anterior: uno sin `estado` vuelve al guardado.
- Un mensaje de otro origen, de otra ventana o de otro `tipo` se ignora.

## Antes de publicar: lista de revisión

- [ ] `version` subió y `publicado` es de hoy.
- [ ] `slug` es igual al nombre de la carpeta.
- [ ] Todas las imágenes existen en `medios/` y tienen `alt`.
- [ ] Los colores se leen con texto blanco.
- [ ] El panel de la parroquia abre sin avisos de error.

## Misas listas y «Entrar» en el panel de OBS

Esto no es del `config.json`: es una ayuda para quien usa el panel.

**Qué son.** Las «Misas listas» son las transmisiones que ya preparaste y guardaste. Salen siempre a la vista en **Preparar** (las 5 más usadas; «Ver todas las misas listas» abre la pestaña «Misas listas»), sin apretar «Cambiar». Al abrir Preparar sigue apareciendo la última misa que usó ese aparato. Cada una dice «Usada hoy», «Usada ayer»… si ya la cargaste, o «Guardada hoy»… si todavía no.

**Cargar una misa lista.** Apretá **Cargar**. Si cambiaste algo que no guardaste, el panel te pregunta antes: «Lo que cambiaste y no guardaste se va a perder. ¿Cargar ‹nombre› de todas formas?». **Cargar igual** la carga; **Volver** (o Esc) te deja como estabas. Al cargar, la línea de estado dice «Cargada: ‹nombre›».

**Cómo entrar en el panel de OBS.**

1. En Preparar, apretá **Entrar con mi cuenta** (junto al estado de la lista; dice «Entrá para ver también las del celular»).
2. Se abre «Entrar con la cuenta del editor web». Escribí el correo y la contraseña de la **misma cuenta del editor web** y apretá **Entrar** (mientras entra dice «Entrando…»). Tiene que ser una cuenta de esta parroquia: con otra, el panel avisa «Esta cuenta no es de esta parroquia». Si te olvidaste la clave, pedísela a quien administra el editor web.
3. La sesión **se queda** en ese navegador de OBS y se renueva sola: no tenés que volver a entrar cada vez. Se pierde solo si apretás **Salir** o si el servidor la rechaza; en ese caso el panel avisa «Se cerró tu sesión. Entrá de nuevo para ver las del celular.». Salir no borra las misas de esta computadora.

Con la sesión iniciada, la app y la PC ven **la misma lista**: lo que guardás, renombrás o borrás en un lado aparece en el otro. Si dos personas cambian la misma misa, queda lo último que se guardó. Sin sesión el panel funciona como siempre, solo con las misas de esta computadora. La app no necesita «Entrar»: sincroniza sola.

**Las misas guardadas antes.** La primera vez que entrás en un panel de OBS, las misas guardadas en ese navegador se suben solas y el panel avisa «Se guardaron N misas de esta computadora en la nube» (con una sola: «Se guardó 1 misa de esta computadora en la nube»). Las guardadas en el dominio viejo (`parroquia-transmision.vercel.app`) **no se pueden leer desde el nuevo**: no se suben solas. Para rescatarlas, abrí el panel viejo, apretá **Entrar** ahí con la misma cuenta, y se suben igual. Lo mismo vale para otro navegador u otra computadora: las guardadas de cada uno suben cuando entrás en ese.

**«Sin conexión. Ves las misas guardadas en esta computadora.»** Significa que el panel no pudo hablar con la nube, así que te muestra las misas de este aparato. No se pierde nada: lo que guardás, renombrás o borrás queda anotado en la computadora y **se sube solo cuando vuelve la conexión** (el panel reintenta cada 2 minutos y al recuperar internet).

**«No se pudo sincronizar. Se vuelve a intentar solo.»** Hay internet, pero la nube no contestó bien (está ocupada o falló un momento). Tampoco se pierde nada: el panel vuelve a probar solo.
