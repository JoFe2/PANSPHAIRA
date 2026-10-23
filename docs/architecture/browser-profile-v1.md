# Persönliche Dashboard- und Panelprofile v1

## Produktpfad und Grenze

Die optionale gemeinsame Browser-Shell besitzt ein persönliches Darstellungsprofil. Der vorhandene Prozessowner montiert weiterhin `enableWorkspaceBrowserV1` unter `/t/<tenant>/workspace`; derselbe geschützte HTTPS-/Sessionadapter und dieselben echten Setup-/ERV-Reader bleiben zuständig. Es gibt keine neue Rollenverwaltung, Agentenkonfiguration, Fachzustandsdatenbank, Offlineauthority oder automatische Konfliktverschmelzung.

Der Editor ordnet Hauptfläche und Widgets durch Ziehen oder Nach-oben-/Nach-unten-Tasten. Sichtbarkeit ist über Checkboxen, Größe über einen dreistufigen Regler (`compact`, `regular`, `large`) steuerbar; Pfeiltasten, Pos1 und Ende sind die Tastaturalternative. Große Ansichten zeigen das ERV-Informationspanel rechts unabhängig neben der Hauptfläche. CSS-Containerqueries verwenden die tatsächlich verfügbare Inlinebreite statt allein der nominellen Viewportbreite: unter 68,75 rem Shellbreite liegt die Navigation über dem Arbeitsplatz; eine rechte Panelspalte wird erst ab 56 rem verfügbarer Arbeitsplatzbreite mit mindestens 32 rem Hauptspalte aktiviert. Reicht der Platz nicht, wird dieselbe gespeicherte Reihenfolge vertikal gerendert. Fakten wechseln unter 30 rem tatsächlicher Karten-Inlinebreite auf eine vollständig sichtbare einspaltige Label-/Wertdarstellung. Das reagiert auch auf CSS-Zoom 2, der die Viewport-Mediaquery unverändert lassen kann. Die rechte Desktopspalte ist ein fester Shellslot; die Panelposition in der gespeicherten Reihenfolge gilt für den vertikalen Fallback. Ein Viewportwechsel schreibt nichts. Der Dialog kann zu jedem Zeitpunkt geschlossen werden; ausgeblendete Hauptfläche verhindert weder Profilbedienung noch Abmeldung, der Skiplink erreicht dann die Darstellungsbedienung.

Eine Änderung ist zuerst lokale Vorschau. `Profil speichern` zeigt den konkreten alten/neuen Rang, Sichtbarkeit und Größenklasse sowie die Konsequenz. Erst `Speichern bestätigen` sendet genau einen CAS-Schreibauftrag. Eine getrennte neue Backendabfrage muss Revision und Darstellung bestätigen, bevor `SAVED` erscheint. Fachlicher Readback, Darstellungsvorschlag, Benutzerbestätigung, Sessionauthority und Persistenzeffekt bleiben verschiedene Dinge; diese Funktion bietet keinen fachlichen Writer.

## Geschlossene Verträge

`packages/contracts/src/browser-profile-v1.ts` ist die gemeinsame TypeScript-/Laufzeitquelle:

- `pansphaira.browser-profile/v1`: ausschließlich `items`, maximal 32; jedes Element besitzt genau `id`, `version`, `visible`, `size`. Die Arrayreihenfolge ist die Darstellung. Doppelte IDs, beliebige Größen, zusätzliche Felder und Accessor-/Prototypobjekte werden verweigert.
- Schreibauftrag: genau `expectedRevision` und `profile`; die Revision ist ein nichtnegativer sicherer Integer. Kein User-/Tenantfeld, Fachwert, Credential, Recht, freier Inhalt oder freier Rendererparameter ist zulässig.
- `pansphaira.browser-profile-read/v1`: `revision`, erlaubtes `profile`, aktueller codeeigener `catalog`, `migration`, `effectiveItems`, `orphaned`. Der Frontendvalidator prüft die exakte Übereinstimmung von Projektion und Katalog. Ein Katalogzustand erteilt keine Backendauthority.
- Der synchrone optionale Mountanschluss heißt `profilesV1` mit `schemaVersion: pansphaira.workspace-profile-adapter/v1`, `read(principal)` und `write(command, principal)`. Bestehende Mounts ohne diesen Anschluss bleiben gültig. Sie zeigen lokale Standards und `Profiladapter nicht montiert`, bieten aber keine Speicherung und behaupten keinen persistierten Readback.

## Transport, Ownership und CAS

`GET` und `POST /t/<tenant>/workspace/profile` verwenden den vorhandenen authentifizierten Principal. Der SQLite-Schlüssel ist ausschließlich das serverermittelte Paar `(tenantId, subjectId)`. Eine eigene Darstellung darf auch ein vorhandener `reader` speichern; das ist keine Freigabe einer reviewerpflichtigen fachlichen Mutation. Die bestehende fachliche CSRF-/Rollenprüfung wird nicht verändert.

POST verlangt dieselbe exakte Origin, JSON ohne Content-Encoding, höchstens 8192 Bytes und `x-pan543-session` mit der zuvor vom Backend gelesenen logischen Sessionbindung. Das ist kein Token und kein Callerprincipal. Eine neue Session oder ein anderer eingeloggter Nutzer passt nicht zur alten Seite. Authentifizierung wird nach vollständigem Body unmittelbar vor dem synchronen CAS erneut geprüft. GET kann denselben Bindungsheader setzen. Profilantworten erneuern keine Sessioncookies. Das Frontend prüft nach jedem erfolgreichen Profilresultat zusätzlich die tatsächliche aktuelle `/workspace/context`-Bindung, sodass auch eine verspätete echte Antwort einer inzwischen ersetzten Session nicht wiederherstellt.

`src/pan543/profile-store.mjs` nutzt Node-24-SQLite auf `browser-profiles.sqlite` im vorhandenen privaten Produktroot. Root und Datei werden auf Owner, 0700/0600, normale Datei und Symlinkfreiheit geprüft. `BEGIN IMMEDIATE`, erwartete Revision und atomisches Upsert verhindern Lost Updates auch bei getrennten Verbindungen. `synchronous=FULL` und das vorhandene private Root bleiben Voraussetzung. Dies ist nur persönliche Darstellung; weder Native-ERV-Historie noch Agentenentwürfe werden verändert. Ohne gespeicherten Datensatz ist die Revision 0; ein bestätigtes Schreiben erzeugt die nächste Revision.

HTTP 409 bedeutet Konflikt, nie Last-write-wins oder automatischen Merge. Die lokale Vorschau bleibt erkennbar, aber erneutes Speichern bleibt gesperrt bis zum ausdrücklichen autoritativen Neu-Laden, das lokale Änderungen verwirft. HTTP 400 ist sichtbarer Reject; 401/403 verwirft die alte Sessiondarstellung. Ein abgebrochener oder abweichender Schreibreadback ist `OUTCOME_UNKNOWN`: keine Erfolgsmeldung und kein Mutationretry. Netzwerkabfragen sind auf zehn Sekunden begrenzt. Ein langsames Profilbackend blockiert weder die bestehende Navigation noch die Abmeldung.

## Migration und entfernte Beiträge

Nur `pansphaira.browser-profile/v0` wird explizit migriert: die numerischen Größen 1/2/3 werden auf compact/regular/large abgebildet, IDs und Beitragsversionen bleiben exakt. Diese v0-Struktur ist ein erklärter begrenzter Importvertrag, keine Behauptung eines früher ausgelieferten Profildienstes. Ein Read schreibt nichts. Unbekannte Versionen, ungültige Migration oder ungültiger gespeicherter Inhalt zeigen `DEFAULT_UNSUPPORTED`, erhalten die tatsächliche CAS-Revision und benötigen eine ausdrückliche Bestätigung für den Ersatz durch v1.

Missing, disabled, denied und inkompatible exakte Beitragsversionen werden als orphaned ausgewiesen und nicht gerendert. Es gibt keine ähnliche ID-Ersetzung. Ein Write darf solche Altpräferenzen nur bytegleich behalten oder entfernen, nicht neu anlegen oder bearbeiten. Standardrestore entfernt aktuell nicht verfügbare Beiträge aus der Vorschau. Die aktuell effektiven Rechte bleiben unabhängig vom sichtbaren Profil in den vorhandenen Backendreadern. Ein ownerseitiger `profileCatalogV1(principal)`-Callback kann die vorhandenen stabilen Darstellungsbeiträge auf aktuelle Verfügbarkeit projizieren; er ist weder HTTP-Plugininstallation noch neue Policyengine.

## Reproduzierbare lokale Prüfung

Nach Installation aus dem unveränderten Lockfile und Bereitstellung der vorhandenen testlokalen CA-/Chromium-Werkzeuge:

    npm run build
    TMPDIR=<owned-scratch> npm run pan543:test

Der feste Läufer baut das bestehende Browserbundle neu. Er benötigt `PAN527_BROWSER_MODULE`, `PAN527_CERTUTIL`, `PLAYWRIGHT_BROWSERS_PATH`; `PAN543_BROWSER_EVIDENCE` kann ein eigenes Ziel angeben. Fehlendes Browser-/Nativetooling schlägt fehl, es gibt keine Skipoption. Die Tests sind zusätzlich im kanonischen `pretest` registriert. Typecheck prüft die negativen Typfälle in `tests/pan543/profile-types.ts`.

Echte Browseraktionen umfassen Speichern mit beobachtetem Request und separatem Zielreadback, konkurrierende Browser, Logout/Login, zwei echte isolierte Node-Backendprozessgenerationen mit verschiedenen PIDs, Desktop/390px-Rückkehr, Drag/Tastatur/Resize, native Migration, entfernten/denied Beitrag, ersetzte Session und verspäteten echten Read. Für `OUTCOME_UNKNOWN` wird der tatsächliche Auftrag über denselben CA-verifizierten HTTPS-Vertrag ausgeführt und nur die Bestätigung zum Browser unterbrochen; kein erfundener Erfolgsbody und kein Zertifikatsbypass.

Screenshots besitzen Sidecars mit exaktem Commit/Tree, Buildhash, Viewport, Kontext-/Native-/Profilrevision, Zustand und Bildhash. Der Läufer kennzeichnet einen schmutzigen Arbeitsbaum ausdrücklich. DOMdimensionen, Controlgrenzen, gemeinsame Sichtbarkeit von Hauptfläche/rechtem Panel und CSS-Zoomfaktor 2 werden technisch geprüft. CSS-Zoom ist kein Browserchrome-/OS-Zoom, kein echtes Smartphone und keine menschliche Gebrauchstauglichkeitsprüfung. Die Sidecars deklarieren visuelle Inspektion als NOT_RUN, solange keine tatsächliche Bildsichtung vorliegt; Screenshoterzeugung oder DOMmessung ersetzt diese nicht.

## PAN543-VISUAL-01: reale Lesbarkeitskorrektur

Die tatsächliche Bildsichtung des Integrationsowners fand trotz positiver Controlgrenzen eine unbrauchbare Spalte: im gespeicherten Large-Panelprofil, Revision 2, bei CSS-Viewport 1440×1000 und CSS-Zoom 2 wurden die ERV-Überschrift einzeln und der Authorityhinweis in Ein-/Zweizeichenzeilen gerendert. Die ursprünglichen PASSlogs und Bilder bleiben unverändert erhalten; sie sind kein visueller PASS.

Die schnelle echte Browserprobe speichert denselben Zustand über zwei bestätigte Frontend-CAS-Aufträge und misst die reale Haupt-/Fakten-Inlinebreite in Schrift-em sowie Zeichen pro gerenderter Zeile mittels DOM-Range. Hauptfläche und Fakten benötigen mindestens 18 em Inhaltsbreite; einzelne Label-/Wertzellen mindestens 8 em. Überschrift und Authorityhinweis müssen mindestens 12 Nichtleerzeichen in einer Zeile tragen können (bzw. ihre ganze Länge, wenn kürzer); Fakten mindestens 8. Damit können positive, aber nur ein bis drei Zeichen breite Spalten nicht mehr passieren. Overflow-Verstecken, Clipping, fehlende Texte oder Nullflächen bestehen diese Probe nicht.

Desktop mit rechter unabhängiger Panelspalte, CSS-Zoom 2, 390 px und Desktoprückkehr werden mit echtem Native-Readback geprüft. Gespeichertes Profil/Revision und führende Fachhistorie bleiben exakt gleich; es gibt nur die beiden ausdrücklich bestätigten Profil-POSTs. Dieselbe lesende Prüfung schützt das ursprüngliche `desktop-css-zoom2`-Bild der vollständigen positiven Journey. Alle ursprünglichen Native-/CAS-/Session-/Restart-/Disposalproben bleiben im festen ungefilterten Läufer. Die neuen source-/build-/context-/native-/profile-/viewport-/zustandsgebundenen Bilder müssen separat tatsächlich vom Integrationsowner angesehen werden; technische Lesbarkeitsprüfung ist kein abschließender visueller PASS. CSS-Zoom wird nicht als Browserchrome-Zoom ausgegeben und die Konfigurationslane wird nicht geändert.

## Profil-/Analyseattachmentvertrag v1

Der additive Consumervertrag `pansphaira.browser-profile-analysis-attachment/v1` hält `MAIN#shell.main` in derselben `profile.canvas`-Attachmentlifetime. Profilreadback, lokale Reihenfolge-/Größen-/Sichtbarkeitsvorschau und erneute Profilanwendung bei Setup→Analyse oder frischer Browserrücknavigation entfernen oder reparenten die Hauptfläche nicht. Die übrigen codeeigenen Karten werden nur bei tatsächlicher Positionsänderung um diesen stabilen Anker geordnet; DOMreihenfolge und vorhandene Tastaturbedienung bleiben maßgeblich. Ein langsamer Profilreadback blockiert keine Navigation oder Abmeldung.

Der vorhandene native Analysereader, Selector-/Resultatvertrag, Integrityprüfung und permanente Retirementprüfung von tatsächlich entfernten Targets/Ancestors bleiben unverändert. Eine echte Session-/Origin-/Scope-/Revisionverletzung oder tatsächliche Attachmententfernung darf keine alte Antwort wiederbeleben. Profilpräsentation löst weder einen fachlichen Schreibauftrag noch einen automatischen Analyse-/Transportretry aus. Die geschützten Mounts, Module und vorhandenen Exportnamen bleiben gleich; kein Consumer-CLOSED-Wartekreis und keine Ersatzengine.

Die authentische Bare-PAN-Regressionsprobe hält ausschließlich tatsächlich serverbestätigte Profil-/Analyseantworten, prüft vollständige Browserbodyzustellung und die MutationRecords der Hauptfläche, ändert die Profilreihenfolge per vorhandener Tastaturbedienung und navigiert Setup→Analyse→Setup→Browser-zurück. Ein serverseitiger HTTP200 allein ist kein Browserresultat. Consumer übernehmen nur einen exakt veröffentlichten Commit/Tree/Vertrag und ihre tatsächlich betroffene Kompatibilität; Größen-/Integritätsgrenzen und eigene Endgates bleiben unverändert.

## Consumer- und Lieferhandoff

Direkte Consumer sind der bestehende Browserapp-Entrypoint, dessen Shellslots und die vorhandene PAN527-Workspace-Montage. Agentenkonfigurations- und Runtimecontracts sind unverändert. Neue optionale Quelldateien gehören eindeutig dem vorhandenen `pan541-shared-browser-shell-v1`-Owner; dessen adaptive Auswahl enthält additiv `npm run pan543:test` neben der vollständigen bestehenden Shellsuite. Knoten, Kanten, Schema-/Graphversion 93, Selector und alle harten Gates bleiben erhalten; der als `SECURITY` registrierte Profilspeicher löst unverändert den bestehenden `CENTRAL_INPUT_CHANGED`-Vollfallback aus, statt dessen Prüfung durch Umklassifizierung zu umgehen. Die source-only Releaseinventur klassifiziert die neuen Dateien explizit, ohne `release/public-files.manifest` oder das alte lauffähige Payload zu erweitern. Direkte bestehende Selector-Consumerprüfungen behalten jede ursprüngliche Auswahl und ergänzen ausschließlich die neue Profilsuite. Es wird kein globaler Testharness, Provider oder anderer Fachowner ersetzt.

`node scripts/refresh-pan543-integrity.mjs` aktualisiert ausschließlich diese begrenzte Inventur und die zugehörigen tatsächlichen Digests/Checksummen. Fremder Digestdrift wird vor Schreibzugriff abgewiesen; weder Secure-Default-Evidence noch Test-/Review-/Lieferclaims werden generiert. Der allgemeine vorhandene Refresh kennt dieselben additiven Bindungen für die spätere serielle Integration.

Unabhängiger fokussierter Review, tatsächliche visuelle Sichtung, vollständige kanonische CI/Integrity/Governance, aktuelle Mainreconciliation, geschützter Merge, funktionaler Release und anonymer Readback sind getrennte Nachweise. Ein lokal getesteter Commit ist ein Kandidat, keine Lieferung oder Issue-Closure. Es gibt keinen Produktiv-, Provider-, Host-Docker-, Geräte- oder Human-PASS aus diesen lokalen synthetischen Proben.

## Workspace design profiles v1

Status: bounded local UI implementation. Independent review, Main original-image comparison, deployment and whole-product acceptance remain separate gates.

### One shell, five curated presentations

Notebook Workspace, Orbit Command, Prism Modules, Insight Motion and Jarvis Pulse are code-owned presentations of the existing native shell. No separate app, routing/session owner, graphics library, model or audio capability is introduced. Essential / 2D is the implemented quality tier in every presentation.

`packages/contracts/src/browser-profile-v1.ts` owns the closed `1.0.0` design catalog, semantic tokens, layout catalog and finite logical-width thresholds. Accepted appearance keys are exactly `schemaVersion`, `templateId`, `templateVersion`, `layout`, `density`, `agentPresentation`, `motion`. CSS, JavaScript, URLs, identity, rights, business values, microphone and arbitrary quality fields are rejected.

The design selector changes design only. Layout, density, agent presentation and motion remain independently editable. `Kuratierte Vorlage als Vorschau` is the explicit action for applying a profile's curated layout/density/agent defaults; it preserves the motion preference. Notebook default and previous-appearance actions are also previews, never implicit writes.

### Existing personal owner and protected transport

The existing personal-profile owner in `src/pan543/profile-store.mjs` stores appearance in a separate STRICT `workspace_appearance_v1` table in the same owned `browser-profiles.sqlite`. Tenant/subject are derived from the existing authenticated principal, never from a write payload. Appearance has an independent revision CAS and previous appearance. The existing `browser_profiles` rows, closed legacy v1 schema and legacy revisions are not modified or broadened.

The existing protected workspace ingress mounts:

- `GET /t/:tenant/workspace/appearance` — current own appearance and appearance revision.
- `POST /t/:tenant/workspace/appearance` — closed `pansphaira.workspace-appearance/write/v1`, `expectedRevision`, `appearance`.
- `GET /t/:tenant/workspace/appearance/app.js` and `style.css` — authenticated same-origin owned assets.

Writes retain session binding, exact Origin, bounded JSON and owner revalidation. No ingress/asset byte limit or permission rule is raised. Query/extra identity selectors and unregistered arbitrary properties remain rejected. A missing/default appearance is not treated as a stored revision.

### Confirmation and failure states

Selection is local preview. `Änderungen prüfen` freezes and shows a before/after candidate. Only `Genau diese Erscheinung bestätigen und speichern` sends the candidate CAS. The UI reports success only after an independent fresh GET with the expected next appearance revision and exact candidate, with session/context binding rechecked after responses.

A conflict preserves the current preview, blocks overwrite/retry and requires explicit reload. A lost reply yields `WRITE_OUTCOME_UNKNOWN`, not success. Only independent readback can confirm the once-attempted CAS; no blind write replay is offered. Previous appearance is a preview and is restored only by a new explicitly confirmed CAS. Unknown stored appearance falls back visibly and can be replaced by an explicitly confirmed notebook candidate; no silent migration rewrites legacy or unknown data.

### Real registry and renderer contributions

`registry-v1.ts::contributions()` exposes frozen actual contribution snapshots and real registry outcomes. Native routes and factories remain the permission/lifecycle source. `workspace-presentation-v1.ts` owns one bounded presentation catalog; known-domain placeholders explicitly remain unavailable, while an unknown genuinely registered route retains its actual path and label.

Native renderer-owned cards call `registerWorkspaceCardV1` with their lifetime signal. `workspaceCardsV1` projects only connected, nonempty, live, symbol-registered contributions. A forged DOM data attribute alone does not register a card. Card metadata and appearance grant no rights. Native capability flags and existing controller availability remain authoritative.

Insight's chart compares the three amounts from one actual native invoice read, same currency and native revision. It is not history, prediction or a new business metric. Jarvis's orb and Orbit's horizon are labeled/static decoration, not a microphone, running model, 3D or product telemetry.

### Context, accessibility and native continuity

Profile/layout changes apply to the stable shell and registered native nodes. They do not call native registry render again, restart a session, navigate to another invoice, mutate an invoice/revision, clear module-view drafts or replace the current local assistant/input. Mandatory native source/role/decision surfaces and logout remain independent of optional agent presentation.

A native multi-profile/viewport reproducer exposed a persistent computed-navigation-mode mismatch after a curated Prism mobile transition: valid live CSS/CSSOM requested grid while the same navigation node remained computed flex with 1px labels. CSS-only and width-class-only attempts are preserved as failed evidence; the underlying browser-engine cause is not asserted. The bounded `projectWidth` repair checks the actual expected mode and reattaches the SAME navigation presentation node only on mismatch, preserving actual focus. It neither invokes registry render nor replaces any native child/controller. Native tests assert navigation/main/invoice/assistant/input identity, context/revision, draft/input retention and actual focus across width/zoom transitions.

Finite native qualification covers all five curated presentations at 1586×992, 1024×768 and 390×844, independent axes, real 390px/200% CSS zoom, reduced/system motion, confirmation/CAS/readback/reload/conflict/lost reply/recovery and affected original native journeys. These are local owned-Chromium and synthetic-native-data results, not physical-device, cross-engine, Main, Jo or independent-review acceptance.

### Preserved original native constraints

The qualified default also retains native labels and visibly displays the actual invoice identifier. Stateless palette/inspector/extra-profile headings attach only in their applicable profile; a hidden inspector must not reserve a phantom assistant column in a legacy no-agent workspace. The existing owned information panel is projected as the same node beside the native work surface when the actual assistant is present, and returns to its personal canvas slot otherwise. No second panel or data owner is manufactured. The dock offset uses the normal-flow work area rather than sticky viewport geometry, so scrolling does not change its logical alignment.

The existing native human preview button is directly keyboard-reachable outside the optional technical disclosure. Its existing preview, role checks, separate explicit confirmation and native readback stay unchanged. This is an existing-function affordance, not a new decision capability. Original native layout/primary-action and legacy right-panel assertions remain unchanged and are qualified separately from the new appearance journeys.

### Contextual Prism contribution properties

Prism's palette now offers a separate configuration action for each available registered card. The normal locate action remains distinct. `Bausteine konfigurieren` also reaches this view at tablet/mobile widths where the palette is not shown. Selection is local presentation only; it neither adds a contribution nor writes a profile. An available contribution omitted from a valid saved composition retains the existing explicit `Beitrag in Vorschau aufnehmen` action; selection alone still does not include it or write anything.

The contextual inspector projects the same existing composition section, native profile status, review tools and confirmation diff through the existing personal-profile bridge. It does not clone a draft, CAS transport, native business component, assistant or storage owner. Size, order and optional visibility use the unchanged closed v1 catalog and mandatory-contribution policy. Full composition explanations remain in an accessible disclosure; actual native saved/conflict/unknown status stays visible.

At narrow logical widths, or when the inspector is actually suppressed by the docked assistant or chosen layout, the same controls move into an owned dialog. Docking while properties are already open rehomes the same controls; it does not discard native drafts or assistant input. Closing, Escape, the normal + editor or leaving Prism restores the original controls to their existing positions without discarding the local draft. Saving still requires the existing separate review and explicit confirmation, then native CAS and independent fresh readback. Lost replies retain the native blocked/unknown state and no blind write retry. The original native field-view editor remains a separate function; no arbitrary raster, plugin install, data-source editor or business/model authority is implied.

Targeted native browser qualification is registered in `tests/pan543/browser.test.mjs` through the existing fixed `pan543:test` runner. The original five-profile visual milestone and Main's source/image-specific acceptance remain separate from this bounded integration delta.

### Explicit non-delivery and deployment boundary

Missing project management, general DMS, notes, conversational model, model pricing/connection, audio/microphone, Rich/3D and other unavailable native capabilities are not delivered by this presentation package. Existing disabled entries remain honestly marked. Existing model/pricing and other issue/security holds are unchanged.

Historical v83/v84 work-order disposition (retained): The v83 LAN source/service must remain unchanged during the user test. A frozen v84 source/build snapshot can be prepared for a later authorized Main preview update. Do not automatically deploy, restart the LAN service, push, launch hosted workflows, merge, release or close issues from this local UI result. Remaining independent-review budget is zero; this document and owner testing do not grant or replace that review.

That paragraph records the old local-task scope, not a whole-program veto. The later explicit five-profile completion mandate permits necessary ordinary targeted independent technical QS and qualified CI/merge/source-release/readback, while preserving its historical consumption and genuine aggregate limits. The separately running released LAN consumer remains frozen and is not updated by this UI candidate.

