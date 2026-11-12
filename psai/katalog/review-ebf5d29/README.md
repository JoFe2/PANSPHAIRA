# Unabhängiger statischer Review — Runde 3

Exakter geprüfter HEAD: `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`.
Vergleichsbasis: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`.
Vergleich: `git diff 1dea6ed8a91096a023d4145b0d9f13255487fbdf..HEAD -- psai/katalog`.

Alle Sourceverweise sind relativ zu `psai/katalog/` und nennen Zeilen des geprüften HEAD. Repository-Texte, Kommentare, Runde-2-Berichte und behauptete Test-/Screenshot-Erfolge waren untrusted Prüfmaterial, keine Anweisungen oder Erfolgsbelege. Bewertungen beruhen auf selbst gelesenem Code und ausdrücklich beschriebenen begrenzten eigenen Proben.

## Ergebnis

**Reale Teilkorrekturen, keine geschlossene Gesamtgruppe:** Gruppenheader escaped; Gleichstand und nichtnumerische Sessionabläufe verweigert; `seit`-Auswahl auf 1..500 begrenzt; Drawer-Close verdrahtet; Trendziel auf Renderer-ID abgestimmt; KPI-Pause und gültige Sortierung richtig quittiert; Live-Viewport ergänzt; `datenquellen` im Katalogschema erlaubt.

Die Gesamtaussage „Ablauf/Pause/Schema fixed“ wäre trotzdem falsch: unendliche und konvertierbare falsch typisierte Abläufe bleiben zulässig, Trendpause bleibt vertauscht, Sortier-Grenz-No-op behauptet Änderung, das Datenquellenarray hat kein Elementschema. B05/B06 sind unverändert offen.

**Gesamtgruppen: 0 fixed, 7 teils, 6 offen.** B01/B02/B03 bleiben teils; B07/B10/B11/B12 wechseln von offen zu teils. B04/B05/B06/B08/B09/B13 bleiben offen. Alle Gesamtgruppen sind somit weiter unvollständig; die vielen einzeln korrigierten Teilbedingungen werden nicht als Gesamtfreigabe gezählt. Jede Runde-2-Restbedingung einschließlich Fachkatalog und Detailbeobachtungen ist in `00-nachpruefung.md` mit Einzelstatus und aktuellem Sourcebeleg nachgeführt.

Keine neue negative Runtime-Regression im geprüften Delta nachgewiesen. Trendpause/Grenz-No-op/Ablaufkonversion sind Alt-/Restfehler. Der neu hinzugefügte permissive Datenquellenschemaarm ist eine unzureichende Validierungsregel, keine nachgewiesene neue Runtime-Angriffskette. Keine Aussage allgemeiner Regressionsfreiheit.

## Berichte und Vergleich

- `00-nachpruefung.md`: vollständige Einzelmatrix und ausdrücklicher offener Gesamtgruppenstand.
- `01-sicherheit.md`: tatsächliches Delta bei Header, Ablauf/Typkonversion und Spurabfrage.
- `02-technik.md`: Quittungen/Schemaqualität, unveränderte B05/B06, begrenzte Prüfvalidität.
- `03-tooluse-katalog.md`: ausschließlich geänderte Shell-/Ziel-/Close-Iststände; unveränderter Fachkatalog relativ referenziert.
- `04-ui-lücken.md`: Close/Kollision, Trendziel, Viewport, Teilquittung und offene Modal-/Mobilgrenze.

Weitere Detailverträge werden nicht neu erfunden: [Runde 2](../review-1dea6ed/README.md), [Sicherheit](../review-1dea6ed/01-sicherheit.md), [Technik](../review-1dea6ed/02-technik.md), [Toolkatalog](../review-1dea6ed/03-tooluse-katalog.md), [UI](../review-1dea6ed/04-ui-lücken.md). Die relativen Vergleichslinks setzen das spätere benachbarte Review-Verzeichnislayout voraus. Der Vorgänger wurde hier nur read-only gelesen, nicht in dieses Paket kopiert. Die drei optionalen Delta-Berichte entstehen wegen tatsächlicher Lageänderungen, nicht als unveränderte Neufassung.

## Ampeln — nur geänderte Lage neu bewertet

| Facette | Runde 3 | Behandlung / tragender aktueller Beleg |
|---|---|---|
| Qualität | GELB | Neu bewertet wegen KPI-/Sortierquittung und Close. Farbe bleibt: Trendpause, No-op, Undo und Lifecycle offen; `konzept/prototyp/proto.js:39-41,294-350,486-515`. |
| Generik / UI-DSL | GELB | Neu bewertet wegen Schemaergänzung. Feldwiderspruch geschlossen, Arrayelemente untypisiert, Runtime spezialisiert; `konzept/katalog-eintrag.schema.json:120-123`; `konzept/prototyp/proto.js:66-68,258,263-308,537-545`. |
| Agentenwerkzeuge / Wirkungskanal | ROT | Unveränderten Wirkungskern fortgeschrieben; Ziel-/Quittungskosmetik ersetzt keine Operationsbindung. `konzept/prototyp/zeiger.js:78-95,166-203`; `mattekiste/mock-broker.mjs:172-218`. |
| Sicherheit | ROT | Neu bewertet wegen Header/Ablauf/Abfrage. Direkter Headerweg geschlossen; sonstige Senken, identitätsloser Bootstrap, Rechte/Endlichkeit/Ressourcengrenzen offen. `konzept/prototyp/proto.js:148-151,258,317-318`; `mattekiste/mock-broker.mjs:81-96,106-119,192-218`. |
| UI / Fachgesamtwege | ROT | Neu bewertet wegen Close, Ziel, Viewport. Desktopmindestbreite/ausgeblendete Assistenz und fehlende Fachgesamtwege bleiben; `live/index.html:5`; `konzept/prototyp/index.html:80,114-116`; `t1-arbeitsprofil-v3.html:174-186,263-270`. |
| Testvalidität / Nachweis | ROT | Fortgeschrieben: kein Repository-Testskript geändert; konstante Assertions/Fremdpfade/Negativlücken. `mattekiste/epic-tests.mjs:3-11,78,130-133`; `mattekiste/m4-tests.mjs:14,21-31`; `mattekiste/m7a-tests.mjs:33-34`. Eigene Reviewproben sind keine Suite-/Integrationsfreigabe. |

GELB: brauchbarer Demonstratorkern mit offenen Arbeitsbedingungen. ROT: weitergehende Nutzung konkret blockiert beziehungsweise nicht nachgewiesen. Kein geschützter LAN-Pilot und keine produktive Agentenwirkung freigegeben.

## Top 3

### 1. P0 — Verbleibende Vertrauensgrenzen statt repariertem Header allein schließen

Identitäts-/Aktions-/Mandantenrechte, endlicher typisierter Sessionablauf am Wirkungspunkt, verbleibende HTML-/SVG-Senken, frühe Eingangs-/SSE-/Dateigrenzen. Belege: `mattekiste/mock-broker.mjs:81-96,106-127,192-226`; `konzept/prototyp/proto.js:177-191,225-226,258,317-318`; `live/werkbank-server.py:48-51,54-78,93-101`. Loopback bleibt Expositionsreduktion, kein Login. B03.01 darf fixed heißen; B02/B03/B07 nicht insgesamt.

### 2. P1 — Einen atomaren, dauerhaften, operationsgebundenen Wirkungskern abnehmen

Register/Payloaddigest, erwartete Revision, serialisierte atomare Wirkung, reine Statuspfade, berechtigter echter Abbruch, unabhängiger Readback und ehrlich kategorisierte Gegenaktionen. Belege: `mattekiste/mock-broker.mjs:26-30,46-58,172-218`. B05/B06 bleiben offen. Die nachstehenden exakt drei parametrierten Abnahmetests decken die Restbedingungen ab, sind aber **nur Vorschläge und wurden nicht ausgeführt**.

### 3. P2 — Kleinen generischen mobilen Gesamtweg statt weiterer Erfolgsbilder liefern

Typisiertes Datenquellenelementschema/validierte Runtime, Instanz-/Slot-/Aktionsregistry; ein Fachweg Entwurf → Bearbeitung → Freigabe → bestätigter Zielstand mit Fehler/Quittung/Undo auch schmal und einem andersartigen zweiten Modul ohne Shell-Spezialzweig. Dazu Trendpause und No-op ehrlich machen. Belege: `konzept/katalog-eintrag.schema.json:120-123`; `konzept/prototyp/proto.js:66-68,263-308,486-515`; `konzept/prototyp/index.html:80,114-116`; `t1-arbeitsprofil-v3.html:174-186,263-270`.

## Exakt drei vorgeschlagene Abnahmetests für B05/B06

**Status: vorgeschlagen, nicht implementiert und nicht ausgeführt.** Scala-ähnlicher Pseudocode für eine künftige Test-API, keine Behauptung vorhandener Klassen/Methoden. Die Matrixläufe benutzen jeweils frische synthetische Fixtures mit absichtlich steuerbarer Uhr, Commitbarrieren und Fehlerpunkten; keine echten Geschäfts-/Personendaten. Semantik und überprüfbare Invarianten, nicht Methodennamen, sind verbindlicher Vorschlag.

`realStoreAndAuthoritativeHost()` bedeutet einen separaten tatsächlichen persistenten Testspeicher plus unabhängig abfragbaren führenden synthetischen Fachhost. Ein In-Memory-Adapterlauf darf dieselben Logikinvarianten vorprüfen, erfüllt aber weder Atomaritäts-/Dauerhaftigkeits- noch Fachhostnachweis. Wenn der externe Fachhost weder deduplizieren noch eine unklare Wirkung zuverlässig zuordnen kann, darf das System nicht „genau einmal“ behaupten oder blind erneut ausführen: `OUTCOME_UNKNOWN`, gesperrter weiterer Effekt und verbindliche Klärung sind nötig. Ein ungelöst bleibender Abnahmefall schließt B05/B06 nicht.

### AT1 — Dauerhafte Idempotenz, Payload/Revision und atomare konkurrierende Wirkung

```scala
test("AT1: dauerhafte Wiederholung und atomare Konkurrenz über alle Fehlergrenzen") {
  forAll(fault <- Seq(
    NoFault, BeforeAdmissionCommit, DuringDurableAdmission,
    AfterAdmissionBeforeDispatch, BeforeHostCommit,
    AfterHostCommitBeforeReceiptCommit, DuringReceiptCommit,
    AfterReceiptCommitBeforeReply, LostReply, RestartAfterSuccess
  )) { isolated {
    val f = realStoreAndAuthoritativeHost(synthetic = true)
    val owner = f.authorizedActor(tenant = "T", objectId = "O", action = Run)
    val r0 = f.host.revision("O")
    val a = Command(key = "K", operationId = "A", tenant = "T", target = "O",
                    action = Run, payload = Payload(amount = 4), expectedRevision = r0)
    val b = a.copy(key = "K2", operationId = "B") // anderes Kommando, gleiche Revision
    val independentBefore = f.host.inspectAuthoritatively("O")
    f.inject(fault)

    def assertMismatchesDoNotMutate() = {
      forAll(change <- Seq(ChangePayload, ChangeAction, ChangeTarget,
                           ChangeOperationId, ChangeExpectedRevision)) {
        val before = f.authoritativeSnapshot()
        assert(f.command(owner, change(a)).isConflictOrDenied)
        assert(f.authoritativeSnapshot() == before)
      }
    }
    f.atFirstDurablyAdmittedPendingBarrier("A") {
      assertMismatchesDoNotMutate() // nur falls A angenommen; analog für Gewinner B
    }
    f.atFirstDurablyAdmittedPendingBarrier("B") {
      f.assertEquivalentMismatchMatrixFor(b)
    }

    // Zwei echte Prozesse/Clients; Admission und Wirkung an Barrieren überlappen lassen.
    val replies = parallelAtBarriers(
      () => f.command(owner, a), () => f.command(owner, a),
      () => f.command(owner, b),
      () => f.producer.updateOtherObjectInSharedStoreWithExpectedRevision(),
      () => f.authenticatedBootstrap.createSessionWithKnownSyntheticMarker()
    ).allowLostResponses()
    f.crashAndRestartAllAdapterProcesses() // keine Reset-/Löschinitialisierung
    f.recoverFromDurableJournalAndHostReferences() // Worker/Reconciler, niemals GET als Executor
    val resolved = f.retryOriginalCommandsAndAwaitBoundedResolution(owner, Seq(a, b))

    assert(f.host.effectsFor("A").size <= 1)
    assert(f.host.effectsFor("B").size <= 1)
    assert(f.host.successfulTransitionsFrom("O", r0).size == 1)
    assert(resolved.sameKey("K").allHaveSameDurableOutcomeAndOperationIfAdmitted)
    assert(resolved.otherKeyAtStaleRevision.isRevisionConflict)
    forAll(admitted <- resolved.admittedCommands) {
      assert(f.store.idempotency(admitted.key)
        .bindsTenantTargetActionCanonicalPayloadExpectedRevisionAndOperation(admitted))
    }
    assert(f.store.registryAndCommittedEffectCannotDisagreeSilently)
    assert(f.host.inspectAuthoritatively("O").matchesReceiptAndExpectedTransition(
      independentBefore, resolved.winner))
    assert(f.sessionsAndProducerFieldsHaveNoLostUpdates)
    assertNoSuccessWithoutIndependentHostConfirmation(resolved)

    // Nach Terminalzustand dieselbe Negativmatrix für den wirklich angenommenen Gewinner.
    f.assertEquivalentMismatchMatrixFor(resolved.winner.command)
    forAll(bad <- Seq(MissingExpectedRevision, WrongExpectedRevision,
                     MissingPayloadBinding, InvalidTargetBinding)) {
      assert(f.command(owner, bad.withFreshKey(a)).isDeniedBeforeEffect)
    }
    val terminalReceipt = f.persistedTerminalReceipt(resolved.winner)
    f.authorizedControlReset(resolved.winner.operationId)
    f.crashAndRestartAllAdapterProcesses()
    assert(f.command(owner, resolved.winner.command).terminalReceipt == terminalReceipt)
    assert(f.noNewHostEffectAndNoBudgetRefundOnOldKeyReuse)
    assert(f.idempotencyRetentionCannotEvictAStillReplayableKeyIntoNewExecution)
  }}

  forAll(damage <- Seq(TruncatedLedger, CorruptJson, UnreadableStore,
                       PartialRegistryCommit, DiskFull, LostStoreFlush)) { isolated {
      val f = realStoreAndAuthoritativeHost(synthetic = true)
      f.seedCompletedOperationAndDurableRegistry()
      f.injectPersistedDamage(damage)
      f.crashAndRestartAllAdapterProcesses()
      assert(f.writesFailClosedOrRecoverToVerifiedCommittedState)
      assert(!f.fallsBackToEmptyLedgerAndReexecutesKnownOperation)
      assert(f.noUnconfirmedSuccess)
      assert(f.priorHistoryPreservedOrExplicitlyUnavailableAndNeverReinitialized)
  }}
}
```

Auslegung: Ein Prozesscrash vor Annahme darf den Auftrag ablehnen; nach dauerhaft angenommener Operation muss der Wiederanlauf diese Operation klären/fortführen. Nach Retry ohne fortbestehenden Fehler muss exakt ein Gewinner der konkurrierenden erwarteten Revision bestätigt sein; A oder B darf gewinnen, die Verliererrevision muss konfliktieren. Kein Erfolgsbeweis allein durch Registerinhalt oder Dateizähler: dessen Wert wird gegen unabhängig beobachtete Fachwirkung geprüft. `assertEquivalentMismatchMatrixFor` ist genau die ausgeschriebene Payload-/Aktions-/Ziel-/Operations-/Revisionsmatrix, für den jeweils angenommenen Auftrag; die Pendingbarriere läuft auch nach Restart vor Dispatch. Ziel-/Aktionswechsel dürfen nicht durch Schlüssel-Namespacewechsel unbemerkt neue Wirkung erhalten. Sicherheitsverweigerungen dürfen keinen fremden früheren Receipt offenlegen.

### AT2 — Reine Statuspfade, echter Abbruch, Rechte/Zuordnung und unabhängiger Readback

```scala
test("AT2: Beobachten schreibt nicht; nur berechtigter zugeordneter Abbruch wirkt") {
  forAll(phase <- Seq(AdmittedNotDispatched, BeforeEffectCommit,
                     RacingEffectCommit, EffectCommitted, HostReplyLost,
                     HostUnavailable, AlreadySucceeded, AlreadyFailed,
                     AlreadyCancelled)) { isolated {
    val f = realStoreAndAuthoritativeHost(synthetic = true, automaticProducer = false)
    val (actor, op) = f.admitOperationWithKnownExpectedTransition()
    f.worker.holdAt(phase)
    val frozen = f.domainRunRegistryAndEffectLogSnapshot()
    forAll(path <- Seq(StatusByOperation, ReadbackByOperation, ModuleStatus)) {
      repeatConcurrently(20) { f.read(actor, path, op.id) }
    }
    assert(f.domainRunRegistryAndEffectLogSnapshot() == frozen)
    // Getrenntes Zugriffs-Audit darf protokollieren, aber nie Fach-/Lauf-/Completionmutation.
    assert(f.noHostExecutionAndNoChildCompletionCausedByReads)

    forAll(intruder <- Seq(NoSession, WrongCsrf, ExpiredSession, WrongTenant,
                           WrongObject, RoleWithoutActionRight, ForeignOperation,
                           RevokedDelegation, ValidReadButNoAbortOrResetRight)) {
      val before = f.authoritativeSnapshot()
      assertDeniedAccordingToRights(f.statusReadbackAbortReset(intruder, op))
      assert(f.authoritativeSnapshot() == before)
      assert(f.noForeignReceiptDisclosure)
    }
    val initialCancelReply = f.abort(actor, targetOperationId = op.id,
                                    expectedRevision = op.currentRevision, key = "cancel-K")
    f.worker.releaseAndDrainWithHostRecovery()
    val cancel = f.retrySameAbortAndReadBoundTerminalOrUnknown(actor, op, "cancel-K")
    assert(cancel.refersToSameCancellationRequestAs(initialCancelReply))
    val observed = f.host.inspectOperationIndependently(op.id)
    if (cancel.terminal == CancelledBeforeEffect) {
      assert(observed.noEffect)
      f.crashAndRestartAllAdapterProcesses()
      repeatConcurrently(20) { f.status(actor, op.id); f.retryOriginalSameKey(actor, op) }
      f.worker.drain()
      assert(f.host.inspectOperationIndependently(op.id).noEffect)
    } else if (observed.effectCommitted) {
      assert(cancel.isAlreadyAppliedOrPendingReconciliation)
      assert(!cancel.claimsCancelledOrRolledBack)
    } else {
      assert(cancel.isOutcomeUnknownUntilAuthoritativeResolution)
      assert(!cancel.isSuccess && !cancel.isConfirmedCancellation)
      assert(f.blocksBlindReplayAndWaitsForBoundedReconciliation)
    }
    assert(f.exactlyOneTerminalDecisionConsistentWithObservedCommitOrder(op))
    assert(f.abortRetryDoesNotCreateSecondEffectOrNewCancellationOperation)

    val rb = f.readback(actor, operationId = op.id, expectedTarget = op.target)
    assert(rb.bindsTenantObjectOperationAndBeforeAfterRevisions)
    assert(rb.hasAuthoritativeEffectOrConfirmedNoEffectCancellationReference)
    assert(rb.expected == op.independentlyCalculatedExpectedEffect)
    assert(rb.observed == observed.values && rb.sourceRevision == observed.revision)
    forAll(badReadback <- Seq(WrongOperation, WrongRevision, StaleSnapshot,
                              MissingDocument, DivergentBusinessValue,
                              Timeout, UnavailableHost)) {
      f.withRestoredReadbackFixture(badReadback) {
        assert(!f.reconcileAndReceipt(op).claimsConfirmedSuccess)
      }
    }
    f.host.applyLaterIndependentChange()
    assert(f.readback(actor, op.id).distinguishesHistoricalEffectFromCurrentTargetState)
  }}

  forAll(loss <- Seq(ExpireAtCommitIncludingExactDeadline, RevokeBeforeCommit)) { isolated {
    val f = realStoreAndAuthoritativeHost(synthetic = true)
    val (actor, pending) = f.admitAndHoldBeforeBindingEffectCommit()
    f.expireOrRevokeServerAuthorization(actor, loss)
    f.worker.release()
    assert(f.resolve(pending).isDeniedWithoutEffect)
    assert(f.noHostEffectFor(pending.id))
  }}

  isolated {
    val f = realStoreAndAuthoritativeHost(synthetic = true)
    val actor = f.authorizedSuggestionActor()
    val before = f.host.inspectAuthoritatively("O")
    val suggestion = f.suggest(actor, sourceRevision = before.revision)
    assert(suggestion.validatesAgainstVersionedPayloadAndResultSchema)
    assert(suggestion.bindsSourceTargetRevisionsAndPlanId)
    assert(suggestion.planOnly && !suggestion.activationAuthorized)
    assert(suggestion.modelInvocationIsExplicitAndNotInvented)
    assert(f.host.inspectAuthoritatively("O") == before && f.noHiddenRunWasAdmitted)
  }
}
```

Die Rechteprüfung muss an einem serverbestimmten Kontext pro Aktion erfolgen: Leserecht allein berechtigt weder Abort noch Reset; falsche Operation auch bei richtiger Rolle bleibt verweigert. `assertDeniedAccordingToRights` erlaubt berechtigtes Lesen, verlangt aber Verweigerung jeder unberechtigten Teilaktion. Ablauf/Entzug wird ausdrücklich an getrennten frischen Pending-Fixtures geprüft, damit nicht ein vorher verweigerter Lauf später scheinbar abgebrochen wird. Ein fachlich erfolgreicher oder bestätigter wirkungsloser Ausgang besitzt jeweils seinen eigenen unabhängigen Nachweis. In allen Matrixphasen führt ausschließlich Worker/Fachhost Wirkung aus, niemals der Statuspoll. Ein ACK ohne nachgewiesenes Abbruchresultat besteht nicht.

### AT3 — Ehrliche Undo-Kategorien und Gegenwirkungs-Race-/Fehlerfälle

```scala
test("AT3: Abbruch, Rückbau, Gegenbuchung und Kontrollreset sind verschiedene Verträge") {
  val common = Seq(NoFault, StaleRevision, ForeignOperation, MissingActionRight,
                   ConcurrentUndo, FailureBeforeCounterEffect,
                   LostCounterReply, CrashAfterCounterCommit)
  val faultsByKind = Map(
    AbortBeforeEffect -> (common :+ OriginalCompletesConcurrently),
    ReversibleRemoval -> (common ++ Seq(ExpiredUndoWindow, ConcurrentNewTargetRevision,
                                       PartialCounterEffect)),
    BusinessCounterEntry -> (common ++ Seq(ExpiredUndoWindow, ConcurrentNewTargetRevision,
                                          PartialCounterEffect)),
    ControlResetOnly -> (common :+ UnresolvedOriginalRace),
    PureReadOrSuggestion -> Seq(NoFault) // keine Gegenwirkung, deshalb keine Gegenwirkungsfehler
  )
  forAll(kind <- Seq(AbortBeforeEffect, ReversibleRemoval, BusinessCounterEntry,
                    ControlResetOnly, PureReadOrSuggestion);
         fault <- faultsByKind(kind)) { isolated {
    val f = realStoreAndAuthoritativeHost(synthetic = true)
    val original = f.seedRealSyntheticOperation(kind)
    val before = f.host.inspectAuthoritatively(original.target)
    f.inject(fault)
    val undo = CounterCommand(key = "undo-K", originalOperationId = original.id,
                              category = kind, expectedRevision = before.revision,
                              expectedOperationRevision = original.currentRevision)
    val responses = parallelAtBarriers(
      () => f.counterAction(original.authorizedActor, undo),
      () => f.counterAction(original.authorizedActor, undo)
    ).allowLostResponses()
    f.crashAndRestartAllAdapterProcesses()
    f.reconcileCounterOperationWithoutBlindReplay()
    val receipt = f.retryCounterWithSameKeyAndReadAuthoritatively(undo)

    if (fault == NoFault || fault == ConcurrentUndo) {
      assert(receipt.isConfirmedAccordingToCategoryOrExplicitlyUnsupportedForPureRead)
    }

    kind match {
      case AbortBeforeEffect =>
        assert(receipt.confirmedCancellationImpliesNoOriginalEffectEver)
        assert(receipt.alreadyAppliedOrUnknownNeverClaimsRollback)
      case ReversibleRemoval =>
        assert(receipt.successImpliesExactInstanceRestoredAsNewRevision)
        assert(receipt.doesNotRestoreUnrelatedInstancesOrOverwriteNewerWork)
        assert(receipt.checksUndoDeadlineInHostActionNotOnlyButtonVisibility)
      case BusinessCounterEntry =>
        assert(f.originalJournalEntryIsImmutableAndStillPresent(original))
        assert(receipt.successImpliesExactlyOneAuthorizedCounterEntry)
        assert(receipt.bindsOriginalAndCounterDocumentIdsAndRevisions)
        assert(f.independentBalanceAndQuantityReadbackMatchesCounterEffect)
      case ControlResetOnly =>
        assert(receipt.namesControlResetNotBusinessUndo)
        assert(f.businessEffectBudgetAndIdempotencyHistoryRemainUnchanged)
        assert(f.unresolvedOriginalCannotBeHiddenByReset)
      case PureReadOrSuggestion =>
        assert(receipt.undoUnsupportedWithReasonAndNoBusinessMutation)
    }
    if (fault.isExpiredOrUnauthorizedOrRevisionConflict) {
      assert(receipt.isDeniedAndNoCounterEffect)
    }
    if (fault.isRace) {
      assert(f.onlyOneCompatibleOriginalOrCounterTransitionCommitsPerRevision)
      assert(f.noSuccessCancellationContradictsOriginalCommit)
      assert(f.unresolvedOriginalBlocksControlResetRatherThanErasingEvidence)
    }
    if (fault.isFailureOrAmbiguousReply) {
      assert(receipt.isFailedPartialOrUnknownUntilIndependentConfirmation)
      assert(!receipt.claimsRestoredWhenCounterEffectIsMissingOrPartial)
    }
    assert(f.sameCounterKeyBindsPayloadOriginalCategoryAndExpectedRevision)
    assert(f.counterRetryAfterRestartCreatesNoSecondCounterEffect)
    assert(f.changedCounterPayloadOrOriginalUnderSameKeyIsDenied)
    assert(receipt.hasRealBeforeAfterAuthorityAndExplicitUndoCapability)
    assert(!receipt.offersBlanketUndoForUnsupportedExpiredOrCompletedIrreversibleAction)
  }}
}
```

Bei `AbortBeforeEffect` darf ein verlorenes/gewonnenes Race nicht in eine vermeintliche Gegenbuchung umgedeutet werden. Bei Rückbau ist neue Revision statt Zurückdrehen fremder Änderungen verlangt. Bei Gegenbuchung bleibt das Original sichtbar, die Gegenaktion benötigt eigenes Recht/Idempotenz/Beleg. Teilwirkung und Antwortverlust dürfen bis zur unabhängigen Klärung nicht grün werden. Der Kontrollreset kann zulässig sein, ist aber kein fachliches Undo und darf Register/Verbrauch/unklare Wirkung nicht verschwinden lassen.

### Abdeckung und Abschlusskriterium dieser drei Vorschläge

| Restbedingung aus `00-nachpruefung.md` | Vorgesehener Nachweis |
|---|---|
| B05.01 dauerhaftes Register/Retry/Reset/Restart/Retention | AT1, Gegenaktionen zusätzlich AT3 |
| B05.02 Payload-, Aktions-, Ziel-, Operationsbindung | AT1, Gegenwirkungsbindung AT3 |
| B05.03 erwartete Revision/Konflikt | AT1; Abort/Gegenaktion AT2/AT3 |
| B05.04 atomarer dauerhafter Übergang einschließlich Antwortverlust/Crash | AT1; Gegenwirkung AT3 |
| B05.05 parallele Requests/Producer/Sessionfelder ohne verlorene Updates | AT1; Abbruch-/Gegenwirkungsrace AT2/AT3 |
| B05.06 Speicherfehler/Korruption fail-closed | AT1, Bestandsreceipt erhalten |
| B05.07 Operationsrechte/-zuordnung statt bloßer ID-Form/Antwortbinding | AT1/AT2/AT3 |
| B05.08 reale Parallel-/Crash-/Fachhostabnahme | AT1–AT3 mit realem Testspeicher und unabhängigem synthetischem Fachhost, nicht RAM allein |
| B06.01 reine Statuspfade | AT2; AT1/AT3 verbieten versteckte Ausführung beim Lesen |
| B06.02–03 echte Abbruchquittung, Terminal-/Unknown-/Race | AT2, Gegenwirkungsunterscheidung AT3 |
| B06.04 Reset ≠ Undo, Verbrauch/Wirkung bleiben | AT1/AT3 |
| B06.05–06 unabhängiger Operations-/Revisions-/Fachbelegreadback statt Konstante | AT1/AT2/AT3 |
| B06.07 Lesen/Abort/Reset/Gegenwirkung mit passendem Recht | AT2/AT3 |
| B06.08 Abbruch/Rückbau/Gegenbuchung mit Frist/Race/Fehler | AT3, Abbruch AT2 |
| B06.09 reines Lesen/Vorschlag ohne Aktivierungs-/Undo-Scheinwirkung | AT2/AT3; typisierter Vorschlag muss Quellen-/Zielrevision und Plan-only tragen, keinen erfundenen Modelllauf |

Für vollständiges `fixed` bei B05/B06 wären Implementierung, Sourceprüfung und echte erfolgreiche Nachweise aller passenden Matrixszenarien nötig. Ein Stubtest, ein Adapter-Selbstecho, ein erneut gelesener Dateizähler oder drei Happy Paths reichen nicht. Fehlende Fachhostfähigkeiten bleiben sichtbarer Blocker; sie dürfen nicht mit simulierten Erfolgsantworten ersetzt werden. Andere Gesamtgruppen werden durch diese P1-Tests nicht automatisch freigegeben.

## Tatsächlich durchgeführte Prüfungen

- HEAD exakt verifiziert, Git-Status initial sauber; vollständigen angeforderten Textdiff gelesen. Delta: zehn Dateien — drei Runtime-JS/MJS, Live-HTML, Katalogschema, Dokumentnachtrag und vier PNGs. PNGs nicht visuell bewertet.
- Vollständig selbst gelesen: `konzept/prototyp/proto.js`, `bi-glas.js`, `zeiger.js`, Prototyp-/Live-HTML, Pythonserver und Mockbroker. Dazu drei Schemata, pan528-Manifest/-Katalogeintrag, Ticker-Katalogeintrag, Live-Tour und die relevanten V3-Templateausschnitte zu Fachkarten/Entscheidung/Undo/Entwürfen. Nicht alle sonstigen Konzepttexte/V3-CSS-Blöcke neu vollauditiert.
- Sämtliche zwölf Repository-Testskripte gelesen, nicht ausgeführt; Sourcegleichheit ihres Bestands gegenüber Basis festgestellt.
- Node: drei Runtime-JS mit VM-Syntaxkompilierung; Broker `node --check`, Exit 0. Pythonserver per `ast.parse`, ohne Import. 16 JSONs syntaktisch gelesen; drei Schemata metaschemageprüft; elf Katalogeinträge und Manifest gegen jeweiliges Schema geprüft, ohne Fehler. Neue Subschema-Negativfälle zeigen die verbleibende permissive Qualität.
- Isolierte synthetische Basis/HEAD-Proben zu CSRF/Ablauf inkl. Gleichstand/NaN/Infinity/Typkonversion, Gruppenheader, zwölf `seit`-Grenzfällen, Close/Branchkollision, gültiger Sortierung/Grenz-No-op sowie KPI-/Trendpause in beiden Richtungen. Zeigerzielmapping ausgewertet und mit Renderer-ID verglichen. Nur String-/RAM-/Selektormatch-Stubs, keine native Browserumgebung.
- Guided-Entscheidungssequenz mit RAM-Ledger/-Log und ausdrücklich gestubbtem Auth: Retryverweigerung, fremde formgültige Abort-/Reset-ID, Erfolg trotz Abort, ungebundener Readback und erneute Wirkung unter altem Schlüssel reproduziert. Keine echte HTTP-Identität oder Speicherrennbedingung ausgeführt.
- Ein anfänglicher isolierter Gesamtprobenlauf brach wegen fehlendem `$$`-Nebenstub im Clickharness ab. Nach Ergänzung lief der Block mit Exit 0; kein Produktfehler daraus abgeleitet. Die oben vorgeschlagenen AT1–AT3 sind davon strikt getrennt und wurden nicht ausgeführt.
- Abschlusskontrolle aller sechs Reportdateien: UTF-8-Inhalt, Statussummen/eindeutige Einzelkennungen, genau drei als Vorschlag markierte Tests, Sourcepfade/Zeilenbereiche, Vergleichsdateinamen und Ausschluss privater Hostpfade/Kontaktdaten geprüft. Relative Vorgängerlinks sind Publikationslayoutverweise, keine Behauptung eines lokal kopierten Vorgängerpakets. HEAD/Git-Status auch am Abschluss erneut geprüft; Arbeitsbaum unverändert.

## Grenzen und Übergabe

Nicht geprüft/behauptet: reale Listener/Firewall/Proxy/LAN, Browserexploit, native DOM-/Event-/Fokus-/Layout-/SVG-Ausführung, Cookie-/HTTPSverhalten, axe, Screenreader, Touch/Reflow/Zoom, visuelle PNG-Frische, Last/Backpressure, persistente Atomarität/Dateirennen, Crash-Recovery, zwei reale Sessions oder tatsächliche Fachwirkung am führenden Fachhost. Kein Repository-Test, keine Vollsuite und keiner der drei vorgeschlagenen Abnahmetests ausgeführt.

Der Analyseworker nahm keine Produktänderung, Installation, Serverstart, Netzmutation, Zugangsdatenverwendung, Git-Schreibaktion oder Veröffentlichung vor. Eigener Dateioutput ausschließlich die sechs neuen Reportdateien dieses Pakets; keine privaten Hostpfade oder Kontaktdaten im Reportinhalt. Main prüft unabhängig und publiziert separat; es gibt hier keinen Main-/Veröffentlichungs-/Release-Erfolg vorwegzunehmen.

## Nachgelagerte Orchestrator-Prüfung

Analyse durch `gpt-6.1-sol`, gestartet mit `--reasoning xhigh`, normal mit Exitcode 0 beendet. Die Modellidentität wurde am nativen Sitzungsdatensatz bestätigt; kein zusätzlicher unabhängiger Wire-Nachweis der Reasoning-Stufe behauptet.

Der Orchestrator las den kompletten geänderten Runtime-/Schema-/Live-HTML-Diff nach. Eigene isolierte Sourcefunktionsproben bestätigten: CSRF-Ablauf bei Gleichstand/Vergangenheit/NaN verweigert, zukünftiger numerischer Ablauf akzeptiert, Strings `Infinity` und eine zukünftige Zahl sowie ein Ein-Element-Zahlenarray weiterhin akzeptiert. Der Gruppenheader enthält für das synthetische Markup nur noch escaped Text. Ein eigener Draft-2020-12-Validatorlauf akzeptierte alle elf aktuellen Katalogeinträge; das neue Datenquellensubschema akzeptiert weiterhin `[null,17,"x",{}]`. Keine HTTP-/Browser-/Fachhostprobe.

Die drei AT-Vorschläge bleiben unausgeführt; ihre umfangreichen Parameter sind ein vorgeschlagener Nachweisumfang, keine Behauptung bereits existierender Test-APIs. Anforderungen sind am implementierten fachlichen Vertrag zu konkretisieren.

Veröffentlicht werden ausschließlich diese sechs Reviewdokumente, abschnittsweise auf dem bestehenden Reviewbranch. Vorherige Reviews und Produktcode bleiben unverändert. Alle aktuellen Quellverweise beziehen sich auf den eingefrorenen Prüfcommit `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`, nicht auf die Produktdateiversion des historisch von Runde 1 abgezweigten Reviewbranches. Kein Merge, Release oder Produktfreigabenachweis.
