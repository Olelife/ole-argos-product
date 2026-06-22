---
title: Aprobación de pólizas desde el portal del asesor
epic: EP-POLICY-APPROVAL
pm: (ejemplo)
status: draft
date: 2026-06-22
country: MX
capability: approve-policy
figma: —
---

# Aprobación de pólizas desde el portal del asesor

> Ejemplo ilustrativo para evaluar el formato del PRD. No es producto real de Olé.

## 1. Problema / Por qué
Hoy una póliza solicitada queda "pendiente" sin un paso claro de aprobación dentro del portal: el asesor
resuelve por canales informales, sin registro ni control. Necesitamos un paso de aprobación trazable.

## 2. Objetivo / Resultado
El asesor puede aprobar o rechazar una póliza pendiente desde el portal, con registro de quién y cuándo.
**Éxito:** 100% de las pólizas pendientes pasan por un estado de decisión trazable (hoy 0%).

## 3. ✅ En alcance
- Ver pólizas en estado **pendiente** del asesor.
- **Aprobar** una póliza pendiente.
- **Rechazar** una póliza pendiente con **motivo**.
- Registrar la decisión (quién, cuándo, motivo) y reflejar el nuevo estado.

## 4. 🚫 Fuera de alcance
- Aprobación **masiva** (varias pólizas a la vez).
- **Captura/cobro de pago** tras la aprobación.
- **Editar** datos de la póliza.
- Aprobación en el mercado **BR** (este PRD es MX).

## 5. Comportamiento de producto
- **Estados:** `pending → approved` | `pending → rejected`. Una póliza ya decidida **no** se vuelve a decidir.
- **Permisos:** solo el asesor **dueño** de la póliza puede decidirla. (Ver Pregunta abierta #1 sobre downline.)
- **Aprobar:** confirma → estado `approved`, sello de fecha/usuario. Se notifica al solicitante.
- **Rechazar:** exige **motivo** (texto, obligatorio) → estado `rejected`, sello, notificación con el motivo.
- **Validaciones:** si la póliza ya no está `pending` (otro la decidió), mostrar estado actual y bloquear la acción.
- **Estado vacío:** sin pólizas pendientes → mensaje "No tenés pólizas por aprobar".
- **Error:** si falla el guardado, no cambiar el estado y avisar; la acción es reintentable.

## 6. Épicas → Historias

### EP-POLICY-APPROVAL-S1 · Aprobar una póliza pendiente
**Como** asesor **quiero** aprobar una póliza pendiente **para** que avance su trámite con registro.
**Criterios de aceptación:**
- [ ] Dado una póliza `pending` propia, cuando la apruebo, entonces queda `approved` con mi usuario y fecha.
- [ ] Dado una póliza ya `approved/rejected`, cuando intento aprobarla, entonces se bloquea y veo el estado actual.

### EP-POLICY-APPROVAL-S2 · Rechazar con motivo
**Como** asesor **quiero** rechazar una póliza indicando el motivo **para** dejar trazable el porqué.
**Criterios de aceptación:**
- [ ] Dado una póliza `pending`, cuando la rechazo **sin** motivo, entonces no se permite y se pide el motivo.
- [ ] Dado una póliza `pending`, cuando la rechazo **con** motivo, entonces queda `rejected` con motivo, usuario y fecha.

### EP-POLICY-APPROVAL-S3 · Ver el resultado de la decisión
**Como** solicitante **quiero** ver el estado actualizado **para** saber si mi póliza fue aprobada o rechazada.
**Criterios de aceptación:**
- [ ] Dado una decisión tomada, cuando consulto la póliza, entonces veo el estado y (si fue rechazo) el motivo.

## 7. ❓ Preguntas abiertas
| # | Pregunta | Dueño | Estado |
|---|----------|-------|--------|
| 1 | ¿El asesor aprueba solo pólizas **propias**, o también las de su **downline**? | PM + Legal | open |
| 2 | ¿Hay un **monto** a partir del cual la aprobación la hace un **supervisor**? | PM | open |
| 3 | Notificación al solicitante: ¿**email**, **in-app**, o ambos? | PM + Diseño | open |

## 8. 📎 Contexto complementario (NO es parte de este trabajo)
- **Jerarquía/linaje de asesores** (`architecture/flows/advisor-lineage`): define quién es "downline" de quién.
  Es relevante para entender la Pregunta abierta #1, pero **construir o mostrar la jerarquía NO es parte de
  este PRD** — acá solo decidimos pólizas. Si #1 resuelve "sí, downline", se evaluará como otro PRD.

## 9. Dependencias / Supuestos
- `ole-api-policy` expone/soporta el estado de la póliza y la decisión (depende de Dev en `/argos:spec`).
- Servicio de notificaciones disponible para avisar al solicitante.
- **Supuesto:** el rol "asesor" ya existe y el portal ya autentica al asesor.
