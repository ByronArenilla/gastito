# ADR 0019 — Las fases de infraestructura se trabajan guiadas, sin SDD

- Fecha: 2026-11-11
- Estado: aceptada
- Fase / spec: 2 en adelante / reemplaza el flujo SDD desde la 014

## Contexto

La fase 1 se hizo con SDD: spec, clarificación, plan, tareas, implementación
y validación, con el agente escribiendo casi todo el código. Sirvió para
construir la aplicación, que era el medio y no el fin.

Desde la fase 2 el fin es otro: que la persona maneje de forma profesional
Docker, Nginx, GitHub Actions, AWS, Terraform, Ansible, Prometheus, Grafana
y Kubernetes, hasta poder aplicar a puestos de DevOps. Con SDD, el agente
escribiría la infraestructura y la persona la leería: quedaría un
repositorio completo y poco aprendizaje.

## Decisión

1. Desde la fase 2 no se usa SDD. Cada entrada del roadmap (014, 015...) es
   una **etapa** que se trabaja en modo guiado: la persona escribe y ejecuta
   la infraestructura; el agente explica, guía, revisa como lo haría un
   colega senior y propone ejercicios. Las reglas están en `AGENTS.md`,
   "Modo guiado".
2. El principio 1 de la constitución cambia: la spec manda en la aplicación
   (fase 1 y cualquier cambio posterior de su lógica); en la
   infraestructura, manda el objetivo de la etapa escrito en su bitácora.
3. Cada etapa deja una bitácora en `docs/bitacora/NNN-nombre.md` en lugar de
   `spec.md`, `plan.md` y `tasks.md`.
4. Los demás principios no cambian: fases en orden, tests y lint como
   puerta, ADR por decisión, todo como código, secretos fuera de Git y el
   tope de costo.

## Alternativas descartadas

- **Seguir con SDD**: produce buena documentación, pero el agente hace el
  trabajo del que la persona necesita aprender.
- **Solo cursos, sin el proyecto**: se aprende la herramienta aislada, sin
  los problemas reales de juntar todas ni un portafolio que mostrar.
- **Que el agente implemente y luego explique**: leer infraestructura hecha
  no da la soltura de escribirla y depurarla.

## Consecuencias

- Cada etapa tarda más que con SDD. Es el costo aceptado.
- El historial de Git muestra el trabajo de la persona, que es lo que mira
  quien contrata.
- Un cambio en la lógica de la aplicación (una regla de negocio, una ruta)
  sigue pidiendo su spec, aunque sea corta.
- Las carpetas `specs/` de la fase 1 quedan como están.
