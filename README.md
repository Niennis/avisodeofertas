# Alerta de ofertas

Sigue productos de tiendas en línea y te avisa por email cuando bajan de precio.

- Pegas el enlace de un producto y eliges cuándo avisarte: cuando la tienda lo rebaje, cuando cueste menos de cierto monto, o ambas.
- Una o dos veces al día se revisan los precios, se guarda el historial y cada persona recibe **un solo email** con sus ofertas nuevas.
- No repite avisos: mientras la oferta siga igual no vuelve a escribir. Solo avisa de nuevo si el precio baja todavía más, o cuando empiece una oferta nueva.
- Cuentas separadas, protegidas con un código de invitación, para compartirla con conocidos.

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
│   ├── domain/                 entidades y reglas puras (cuándo avisar, URLs, precios)
│   └── application/
│       ├── ports/              interfaces que el núcleo necesita (PriceReader, Notifier, repositorios…)
│       └── use-cases/          AuthService, WatchService, checkPrices
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
- **Avisos por Telegram:** crea otra clase que implemente `Notifier` y úsala en `container.ts`.

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
2. En *Settings → Environment Variables*, agrega las mismas variables de `.env.local`, con `APP_URL` apuntando a tu dominio de Vercel. `CRON_SECRET` es obligatorio: sin él, el endpoint rechaza las llamadas.
3. Cada despliegue aplica primero las migraciones pendientes (`buildCommand` en `vercel.json`). Si una falla, el despliegue se detiene y queda funcionando la versión anterior. Ojo: los despliegues de prueba (*preview*) usan la misma base si comparten `DATABASE_URL`.
4. `vercel.json` programa una revisión diaria a las 12:00 UTC (8:00 o 9:00 en Chile). El plan gratuito de Vercel permite un cron al día; para una segunda revisión está `.github/workflows/revisar-precios.yml`, que llama al mismo endpoint (configura los secretos `APP_URL` y `CRON_SECRET` en GitHub).

## Buenas prácticas con las tiendas

- Entre productos de una misma tienda se espera 1,5 segundos, y se revisa una o dos veces al día.
- Si una tienda cambia su página y deja de leerse el precio, la app lo muestra en rojo en la lista con el motivo.
