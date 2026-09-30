# Alerta de ofertas

Sigue productos de tiendas en línea y te avisa por email cuando bajan de precio, cuando la oferta es de verdad o cuando vuelven a tener stock.

## Qué hace

### Seguir productos

- Pegas el enlace de un producto y la app lee su nombre, foto y precio en el momento.
- Un solo enlace puede seguir **todos los colores de una lana** (ver *Líneas con varios colores*, más abajo).
- El **mismo producto en varias tiendas** se junta en una sola tarjeta con el mejor precio y una comparación por tienda.
- **Desde el celular (Android):** con la app instalada, en la página de la tienda tocas *Compartir → Ofertas* y se abre con el enlace ya pegado.

### Cuándo avisar

Cada producto tiene sus propias condiciones, que se pueden combinar:

- **Cuando la tienda lo rebaje.**
- **Cuando cueste cierto monto o menos** (precio objetivo).
- **Cuando vuelva a haber stock:** avisa cuando un producto (o un color que sigues) pasa de agotado a disponible. Funciona con las tiendas que informan el stock.

Los precios se revisan dos veces al día: a las **09:00 y 20:00** de Chile en horario de verano (una hora antes en invierno). Cada persona recibe **un solo email** con todas sus novedades, y el asunto cambia según haya ofertas, productos que volvieron o ambas cosas.

No repite avisos: mientras la oferta siga igual no vuelve a escribir. Solo avisa de nuevo si el precio baja todavía más, cuando empieza una oferta nueva o cada vez que un producto vuelve a tener stock.

### ¿Es buena oferta?

Con el historial de precios la app dice si conviene comprar:

- **Rebaja real u oferta dudosa.** Compara el precio rebajado con el más bajo de los **30 días anteriores** a la rebaja (la misma regla que la directiva europea "Omnibus" exige a las tiendas). Si ya costaba eso o menos, la oferta es dudosa: típicamente, la tienda subió el precio antes de "rebajarlo".
- **Precio más bajo en 90 días.** Se marca cuando el precio actual es menor que todos los anteriores (con al menos dos semanas de historial).

Se ve como etiqueta en las tarjetas ("Mínimo en 90 días", "Oferta dudosa"), explicado en la ficha del producto y en el email de avisos. En las líneas con varios colores solo se muestra en la ficha, porque el historial es del precio destacado de la línea.

### La lista de productos

- Las ofertas vigentes aparecen primero, en "En oferta ahora".
- Búsqueda por nombre, marca o nombre del grupo, filtro por tienda y por estado (en oferta, sin oferta, con problemas) y orden por más recientes, mayor descuento, menor precio o nombre. Los filtros quedan en la URL.
- Toda la tarjeta abre la ficha del producto.

### Ficha del producto

- Precio actual, precio "antes", disponibilidad y análisis de la oferta.
- **Historial de precio** en un gráfico, con el precio normal y el precio objetivo.
- **Actualizar precio:** consulta la tienda en ese momento (sin enviar emails; si hay oferta, se avisa en la revisión siguiente). No vuelve a consultar si se revisó bien hace menos de 5 minutos.
- Condiciones de aviso, colores que sigue (en las líneas), agregar otra tienda o agrupar con otro producto, y dejar de seguirlo.

### Cuentas

- Cuentas separadas, protegidas con un **código de invitación**, para compartirla con conocidos.
- **Recuperar contraseña** por email: enlace de un solo uso que vence en una hora. No revela si un email tiene cuenta, envía como máximo un enlace por minuto y, al cambiar la contraseña, cierra las demás sesiones.
- En *Mi cuenta*: activar o desactivar los emails y elegir la **paleta de colores** (Sobria, Caramelo, Eléctrico o Jardín). En cualquier página se puede cambiar entre modo claro y oscuro.

### Instalable en el celular (PWA)

Se puede instalar como app: en Android, desde Chrome (*⋮ → Instalar app*); en iPhone, desde Safari (*Compartir → Agregar a inicio*). Abre a pantalla completa con su propio ícono. Recibir enlaces desde *Compartir* solo funciona en Android.

### Administración

Quien administra la app (`ADMIN_EMAIL`, o `SMTP_USER` si no está definido) tiene la página `/admin`:

- **Revisar ahora:** hace la revisión completa en el momento, igual que la programada (incluidos los emails), y muestra un resumen.
- **Tiendas con problemas:** los enlaces que no se pudieron leer, agrupados por tienda (ver [Tiendas que no se pueden leer](#tiendas-que-no-se-pueden-leer)).

## Tiendas probadas

| Tienda | Plataforma | Cómo se lee el precio |
|---|---|---|
| Revés Derecho, Orquídea, Modista | Shopify | JSON público `/products/<handle>.js` |
| Lana Móvil | WooCommerce | Store API `wp-json/wc/store/v1/products` |
| Con Amor Amor | Jumpseller | Metaetiquetas `product:price` / `product:original_price` |
| Reginella | PrestaShop | `.current-price-value` y `.regular-price` |
| Farmacias Ahumada | Salesforce Commerce | `.sales .value` y `.strike-through.list .value` |
| Salcobrand | Spree | "Precio Farmacia" y "Precio Internet" en `#product-price` |
| Cruz Verde | API propia | `api.cruzverde.cl/product-service/products/detail/<id>` |

**Otras tiendas:** cualquier tienda Shopify, WooCommerce o que publique datos estructurados (JSON-LD `Product` o metaetiquetas Open Graph de producto; por ejemplo Jumpseller o Tiendanube) debería funcionar sin cambios. Para probar una URL:

```bash
pnpm try-url "https://tienda.cl/products/algo"
```

**Mismo producto en varias tiendas:** en el detalle de un producto, "Agregar otra tienda" (pegando el enlace) o "Agrupar con uno que ya sigues" los junta en una sola tarjeta con el mejor precio y una comparación por tienda. Los avisos siguen funcionando por tienda. La búsqueda considera el nombre del grupo, el nombre en cada tienda y la marca, cuando la tienda la informa.

**Líneas con varios colores:** un solo enlace puede seguir todos los colores de una lana.

- En Shopify, el enlace del producto sin color elegido sigue todos sus colores. Con `?variant=...` sigue solo ese color.
- En PrestaShop (Reginella), el enlace de una categoría como `reginella.cl/2188-roma` sigue todos los productos de la línea.
- En el detalle del producto se pueden desmarcar colores. Los colores nuevos que agregue la tienda quedan incluidos.
- Se avisa cuando cualquier color incluido entra en oferta o baja del precio objetivo, y el email dice cuáles.

## Tiendas que no se pueden leer

Si alguien pega un enlace que la app no sabe leer, ve un mensaje claro ("Todavía no sabemos leer el precio de esta tienda", "La tienda está bloqueando la consulta automática", etc.) y el intento queda registrado. Lo mismo pasa con un producto que falla dos revisiones seguidas.

Quien administra la app (`ADMIN_EMAIL`, o `SMTP_USER` si no está definido) ve esos fallos agrupados por tienda en `/admin` y recibe un email de resumen cuando aparecen fallos nuevos. Para dar soporte a una tienda nueva hay que agregar un lector (ver más abajo) y publicar la nueva versión.

## Arquitectura hexagonal

```
src/
├── core/                       ← no depende de Next.js, de la base de datos ni de las tiendas
│   ├── domain/                 entidades y reglas puras (cuándo avisar, URLs, precios, stock, análisis del historial)
│   └── application/
│       ├── ports/              interfaces que el núcleo necesita (PriceReader, Notifier, repositorios…)
│       └── use-cases/          AuthService, WatchService, GroupService, AdminService, checkPrices
├── adapters/                   implementaciones concretas de los puertos
│   ├── price-readers/          Shopify, WooCommerce, Cruz Verde + extractores de HTML
│   ├── persistence/drizzle/    Postgres (Neon) con Drizzle ORM
│   ├── notifications/          email por SMTP (o consola en desarrollo)
│   └── security/               hash de contraseñas con scrypt
├── composition/container.ts    ← único lugar donde se eligen los adaptadores
├── web/                        adaptador de entrada: sesiones, server actions, componentes
└── app/                        rutas de Next.js (páginas y endpoint del cron)
```

Ejemplos de cambios que no tocan el núcleo:

- **Soportar una tienda nueva:** agrega un `HtmlExtractor` en `adapters/price-readers/html/extractors.ts` (o un `PlatformReader` si la tienda tiene API) y súmalo a la lista.
- **Cambiar Neon por otra base:** implementa los repositorios con otra tecnología y cámbialos en `container.ts`.
- **Otro canal de avisos:** crea otra clase que implemente `Notifier` y úsala en `container.ts`.

## Puesta en marcha

### Requisitos

Node.js 20.9 o superior y [pnpm](https://pnpm.io) 10 (el proyecto fija la versión en `packageManager`).

### 1. Base de datos (Neon)

1. Crea un proyecto en [neon.tech](https://neon.tech) y copia la *connection string*.
2. Copia `.env.example` a `.env.local` y pega la cadena en `DATABASE_URL`.
3. Crea las tablas:

   ```bash
   pnpm install
   pnpm db:migrate
   ```

> **Sin Neon:** con `DATABASE_URL=pglite:.pglite` la app usa un Postgres embebido en la carpeta `.pglite` y crea las tablas sola. Sirve para probar en tu computador. PGlite admite un solo proceso a la vez: detén `pnpm dev` antes de ejecutar `pnpm check-prices` (con Neon no hay esa limitación).

### 2. Email

Con Gmail:

1. Activa la verificación en 2 pasos en tu cuenta de Google.
2. Crea una [contraseña de aplicación](https://myaccount.google.com/apppasswords).
3. En `.env.local` completa:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=tu-correo@gmail.com
   SMTP_PASS=la-contraseña-de-aplicación
   ```

Para comprobar que funciona, ejecuta `pnpm test-email`: envía un aviso de ejemplo a tu propio correo.

Gmail puede enviar a cualquier destinatario (hasta unos 500 emails al día), así que sirve también para tus conocidos. Si no configuras SMTP, los avisos se muestran en la consola.

### 3. Correr en local

```bash
pnpm dev                # http://localhost:3000 (antes aplica las migraciones pendientes)
pnpm check-prices       # revisa precios y envía avisos (lo mismo que hace el cron)
pnpm test               # tests del dominio, extractores y flujo completo
```

Para probar el diseño con muchos productos sin tocar Neon, crea una base local con 60 productos ficticios y levanta la app con ella (cuenta `demo@correo.cl`, contraseña `clave-segura`):

```bash
DATABASE_URL=pglite:.pglite-demo pnpm seed-demo 60
DATABASE_URL=pglite:.pglite-demo pnpm dev
```

En PowerShell, define la variable antes: `$env:DATABASE_URL="pglite:.pglite-demo"`. El script se niega a ejecutarse contra una base que no sea local.

### 4. Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en [Vercel](https://vercel.com).
2. En *Settings → Environment Variables*, agrega las mismas variables de `.env.local`, con `APP_URL` apuntando a tu dominio de Vercel (se usa en los enlaces de los emails, incluido el de recuperar contraseña). `CRON_SECRET` es obligatorio: sin él, el endpoint rechaza las llamadas. Genera uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Cada despliegue aplica primero las migraciones pendientes (`buildCommand` en `vercel.json`). Si una falla, el despliegue se detiene y queda funcionando la versión anterior. Ojo: los despliegues de prueba (*preview*) usan la misma base si comparten `DATABASE_URL`.
4. `vercel.json` programa una revisión diaria a las 12:00 UTC (8:00 o 9:00 en Chile, según el horario). El plan gratuito de Vercel permite un cron al día; la segunda revisión, a las 23:00 UTC, la hace `.github/workflows/revisar-precios.yml` llamando al mismo endpoint. Configura en GitHub (*Settings → Secrets and variables → Actions → Repository secrets*) los secretos `APP_URL` y `CRON_SECRET`, con los mismos valores que en Vercel. Desde la pestaña *Actions* también se puede ejecutar a mano (*Run workflow*).

## Buenas prácticas con las tiendas

- Entre productos de una misma tienda se espera 1,5 segundos, y se revisa dos veces al día.
- "Actualizar precio" no vuelve a consultar un producto que se revisó bien hace menos de 5 minutos, aunque lo sigan varias personas.
- Si una tienda cambia su página y deja de leerse el precio, la app lo muestra en rojo en la lista con el motivo.
