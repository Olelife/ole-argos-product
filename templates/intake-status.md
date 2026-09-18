---
slug: <slug-kebab>
title: <título del intake>
status: draft            # draft | in-review | ready | in-delivery | done
owner: <PM>
capability: <kebab-en>   # ancla con el cerebro (architecture/flows/<capability>)
prd_version: v1
figma_version: v1        # apunta a figma/v1/
figma_url: <url con node-id o "—">   # o un bloque anidado con una URL por sección (asesores: …, portal-ole: …)
updated: <YYYY-MM-DD>
# --- opcionales (los leen los scripts del motor; borrá los que no apliquen) ---
# jira_project: SO                 # proyecto de Jira (widget de tickets, handoff)
# jira_base: https://olelife.atlassian.net   # host de Jira para los links
# jira_title_prefix: "[Producto][Módulo]"     # prefijo de los títulos al crear en Jira
# jira_epics: [SO-000]             # épicas que barre /avance
# jira_goal_status: Ready to Prod  # meta = historia cerrada (también cuenta en dashboard/INDEX vía "Estado Jira")
# jira_stage_order: ["Tareas por hacer", "En curso", "Staging", "Ready to Prod"]
# base_branch: <rama>              # rama de integración propia (sección "Base técnica" de la épica)
# deploy_env: <INT | staging-mx | staging-br>
# source_intake: intakes/<slug>    # intake origen (adaptación de mercado)
# roadmap_artifact_url / avance_artifact_url: los escriben los verbos al publicar
---

# Intake · <título>

<!-- argos:auto -->
(lo regenera scripts/status-render.mjs: dudas · historias · versiones · épicas · entregables)
<!-- /argos:auto -->

**Resumen:** <1-2 líneas de qué es y en qué estado está — la prosa del PM va acá, fuera del bloque auto>.
