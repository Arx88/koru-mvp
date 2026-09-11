# MICHI: pantallas móviles y avatares

Ajustes sigue la referencia aprobada del usuario: fondo celeste luminoso, tarjetas blancas translúcidas, acentos azules, cabecera con Michi y un engranaje. Perfil se abre desde su tarjeta y permite editar datos, personas y retrato. Memoria, Hoy, Historial y Crear usan Nunito, los paisajes existentes, superficies frías y los iconos 3D originales. La memoria conserva los gustos, personas y recuerdos que ayudan a Michi a acompañar al usuario.

## Catálogos

- Los 15 retratos proceden del catálogo completo `Avatares`; reemplazan las opciones anteriores sin duplicarlas. Están disponibles desde el inicio. Los retratos art-20 a art-25 se migran a su equivalente.
- Los 8 Michis existentes se conservan, junto a los 20 de `Michi Avatars`. `public/assets/michi-world/inventory.json` mantiene la correspondencia con los archivos del usuario.
- Nivel = 1 + floor(trustedEnergy / 100), sin alterar la energía existente. Se conservan los niveles originales 1, 10–40; los nuevos se desbloquean cada cinco niveles, del 45 al 140, configurables en `avatarCatalog.ts`.
- Las elecciones se validan contra el nivel y persisten localmente. Se comparten entre instancias y pestañas; no hay sincronización entre dispositivos.

## Recursos visuales

`public/assets/michi-icons/` contiene los 41 iconos originales optimizados a WebP y `settings-michi.webp`, un recorte generado con ImageGen desde la referencia de Ajustes. El prompt conserva al gato dorado con gafas negras y engranaje azul, solicita fondo transparente y excluye texto e interfaz. Los 35 avatares se optimizaron sin cambiar su arte. Los originales del escritorio permanecen intactos.

## Comportamiento y verificación

Las pruebas cubren navegación, crear y recuperar notas, todas las imágenes de avatares, bloqueo y equipamiento, persistencia, perfil y personas, edición/confirmación/exclusión/olvido de recuerdos, preferencias y movimiento reducido. Las preferencias de tamaño se aplican al texto de las nuevas pantallas. Oscuro y automático siguen indicados como próximos porque la app aún no implementa esos modos.

La compilación de producción y las pruebas de App, CreateScreen y HomeNudgeMarker se verifican junto con los recorridos móviles y de escritorio. Dos fallos preexistentes de la suite general se reprodujeron en la base original: zona horaria de heartbeatProactive y formato numérico de pdfExport.

El saludo de la mañana espera a que termine la carga de la cuenta antes de persistir su marca diaria. Así no puede reemplazar el progreso y los recuerdos guardados por el estado inicial vacío. Un recorrido adicional fija la hora a las 07:30 y comprueba la conservación después de recargar.
