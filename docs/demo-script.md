# Demo Script

Date: 2026-07-10

This walkthrough uses the active v2 client. It creates a fresh garden during
the demo; there is no canned city, preset workspace, or hidden watering
calendar.

## Preparation

1. Run `npm run dev` in mock mode.
2. Clear site data for the dev origin, or use a fresh browser profile.
3. Open `/sign-in` and use either configured mock email with password
   `password`.
4. Keep the browser online so offline banners are meaningful if demonstrated.

Do not enter production credentials or a real private address in a recorded
demo. If Firebase delivery is part of the walkthrough, use a provisioned test
account and a deliberately selected test location.

## Product story

Secret Faeries is a field book for one real food garden. Plan records what is
physically there. Today turns the saved crop groups into separate, explainable
watering decisions and practical work. Feed records what happened. Settings
makes the climate and alert assumptions explicit.

## Walkthrough

### 1. Sign in and route protection

Open `/app/today?focus=watering` while signed out. Sign in and show that the app
returns to the guarded deep link. Point out that there is no registration path:
mock mode has exactly two configured accounts, while production uses two
provisioned Firebase accounts with claims.

### 2. Create the measured plot

On the setup dialog:

- name the garden `Kitchen garden`
- enter a 20 ft by 14 ft plot
- choose the raised-bed starting structure
- enter a deliberately selected non-private location label/query, exact test
  coordinates, valid IANA timezone, USDA hardiness zone, and typical first/last
  frost dates
- create the plan

Show that dimensions and positions are in feet. Setup cannot complete from the
internal empty plan's null coordinates/neutral timezone; the app requires the
gardener to supply operational climate facts and does not locate the garden in
a preset city.

Add a path or container, then select the raised bed and edit its soil,
drainage, mulch, and soil-depth context. Drag it within the plot and use keyboard
arrow movement to show that pointer and keyboard input update the same
feet-based state.

### 3. Add two independently modeled crop groups

Add one growing Tomato group and one growing Lettuce group. Assign both to the
raised bed, but give them distinct crop-group positions. Select each group and
show its saved water-model inputs:

- weekly need
- root depth
- depletion fraction
- confidence/source/version
- establishing, flowering, fruiting, and mature coefficients

Explain the key invariant: sharing a structure does not pool the crops. Each
`PlantingGroup.id` retains its own versioned water-profile snapshot, balance,
recommendation, reasons, and alert identity.

Move a group, edit a water input, and use **Save draft**. Open **Review** to
show blocking versus non-blocking geometry problems and ignore/restore a
review decision. Use **Check layout** to preview the single checked proposal
before explicitly applying it.

Publish the private draft with a short change summary. Open **History** and
show that restore is a second explicit publish, not a silent overwrite. Do not
actually restore unless the remainder of the demo is meant to restart.

### 4. Verify safe watering in Today

Open Today. In mock mode there is no fresh canonical Functions result, so Tomato
and Lettuce appear as separate conservative soil-check cards. Each card names
its crop group, shows data quality, explicit stage/stage source, profile
provenance, and root-zone context, exposes reason details and calculation basis,
and links field logging to only that group.

This is the intended safety behavior: the app keeps the crops cohesive with
the plan but does not invent rain, evapotranspiration, gallons, or a city-based
watering amount.

Open Tomato's **Log watering decision** dialog and record an applied amount in
inches or gallons. Record a partial amount for Lettuce, then record a skip where
appropriate with a reason such as `Soil is still moist`. Note that partial
credits only its explicit amount and a skip is stored structurally without an
amount or efficiency and always receives zero water credit.

If a task fixture is present, demonstrate complete, snooze, defer, and reopen.
Use an exact Today deep link to show focus behavior:

- `/app/today?focus=watering&cropGroupId=<crop-group-id>`
- `/app/today?focus=task&taskId=<task-id>`

### 5. Record field memory in Feed

Open Feed and show the separate Tomato and Lettuce watering activity. Use
**New entry** to create:

- a garden or crop-targeted note
- a structured issue with severity/category
- a harvest for a specific crop group
- an optional photo update while online

Change an issue between open, in progress, and resolved. Use search, type,
target, and status filters. Emphasize that Feed is a private operational record,
not a social stream. Show the **You**/**Garden member** attribution, partial
filter, and watering correction flow: the correction keeps the same record ID,
crop group, and original recorder while advancing the revision. If the browser
is taken offline, show that the app makes no durable queue promise for text or
selected photo bytes.

### 6. Make alert assumptions explicit in Settings

Open Settings and show the split between shared garden facts and private
account preferences:

- location label/query, required exact coordinate pair, and garden timezone
- hardiness zone and typical frost dates as editable assumptions
- alert kinds, daily check time, quiet hours, and minimum watering deficit
- push consent/registration, device capabilities, and private delivery history

Try saving one invalid IANA timezone or only one coordinate to show focused
validation. Then save a deliberately selected valid timezone and both
coordinates. Do not use a memorized default city. Explain that the next
canonical Functions refresh can use real weather evidence, while push still
requires explicit consent, a production VAPID key for web, and complete native
configuration. In delivery history, **Sent to push service** is provider
acceptance, not proof that a device displayed the message.

### 7. Close the loop

Return to Plan and confirm the two crop groups still own distinct water-profile
snapshots. Return to Feed to show the applied, partial, and skipped field
decisions. The story should end with this loop:

`Plan -> deterministic crop-group operation -> Today action -> Feed memory ->
future balance`

## Closing line

Secret Faeries does not guess where the garden is or average unrelated crops.
It keeps one measured plan and turns evidence into crop-specific work only when
the evidence is strong enough.
