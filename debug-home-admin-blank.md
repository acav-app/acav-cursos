[OPEN] Debug session: home-admin-blank

# Síntoma
- El inicio no muestra contenido visible.
- El panel admin tampoco muestra contenido visible o navegable.

# Hipótesis iniciales
1. El contenido sí se monta, pero queda invisible por estilos/animaciones/clases de opacidad o layout.
2. El `PublicCoursesShell` o el layout del dashboard renderizan correctamente, pero un error de runtime en un componente hijo aborta la pintura.
3. La carga de datos o del actor entra en un estado inválido y deja la UI en una rama vacía.
4. El problema proviene de un contenedor compartido, overlay o z-index que tapa tanto la home como el panel admin.
5. Hay errores de hidratación o de cliente que no rompen el servidor, pero impiden la renderización visible en browser.

# Evidencia pendiente
- Reproducir home.
- Reproducir dashboard admin.
- Revisar consola del navegador.
- Revisar logs del servidor.
- Verificar diagnósticos recientes.
