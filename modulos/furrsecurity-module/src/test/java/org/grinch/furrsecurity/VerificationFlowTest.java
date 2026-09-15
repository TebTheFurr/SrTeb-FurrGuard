package org.grinch.furrsecurity;

import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.log.PluginLogger;
import org.grinch.furrsecurity.api.Replies;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.manager.VerificationManager;
import org.grinch.furrsecurity.platform.PlatformHandler.PlayerInfo;
import org.grinch.furrsecurity.support.FakeApi;
import org.grinch.furrsecurity.support.FakePlatform;
import net.kyori.adventure.text.Component;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.grinch.furrsecurity.support.FakeApi.failure;
import static org.grinch.furrsecurity.support.FakeApi.ok;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VerificationFlowTest {

    private static final String VERIFIED = "{\"needs_verification\":false,\"reason\":\"already_verified\","
            + "\"session\":{\"expires_at\":\"2026-09-15 20:00:00\",\"time_remaining_seconds\":3600}}";
    private static final String NO_SESSION = "{\"needs_verification\":true,\"reason\":\"no_valid_session\"}";
    private static final String TOKEN = "{\"success\":true,\"token\":\"t1\",\"verify_url\":\"https://fg.test/verify.php?token=t1\","
            + "\"existing\":false,\"token_expires_in_seconds\":180}";
    private static final String PENDING = "{\"status\":\"pending\",\"verified\":false,\"token_expires_in_seconds\":120}";
    private static final long POLL = 5_000;

    private final PlayerInfo staff = player("Staffer", true);

    @TempDir
    Path dataDirectory;

    private final List<String> events = new ArrayList<>();
    private FakePlatform platform;
    private FakeApi api;
    private FurrSecurity core;

    private void start(String config) throws IOException {
        if (config != null) {
            Files.writeString(dataDirectory.resolve("config.yml"), config);
        }
        platform = new FakePlatform(events, false);
        api = new FakeApi(events);
        core = new FurrSecurity(PluginLogger.of(message -> { }, message -> { }, (message, error) -> { }),
                dataDirectory, platform, apiConfig -> api);
        core.enable();
        platform.advance(0); // primera sincronizacion (sin respuestas: fallo de red)
        events.clear();
        api.calls.clear();
    }

    private void start() throws IOException {
        start(null);
    }

    private VerificationManager verifier() {
        return core.verifier();
    }

    private void join(PlayerInfo player) {
        platform.online.put(player.uuid(), player);
        verifier().onJoin(player, true);
    }

    private void joinWithPendingToken() {
        api.reply("check_status", ok(NO_SESSION)).reply("generate_token", ok(TOKEN)).always("verify_token_status", ok(PENDING));
        join(staff);
    }

    @ParameterizedTest
    @EnumSource(Kind.class)
    void anyApiFailureKeepsTheStaffLockedAndRetries(Kind kind) throws IOException {
        start();
        ApiResult failure = failure(kind);
        api.reply("check_status", failure);

        join(staff);

        assertTrue(verifier().isLocked(staff.uuid()), "un " + kind + " no puede dejar pasar");
        assertFalse(events.contains("unlock:Staffer"));

        api.reply("check_status", ok(VERIFIED));
        platform.advance(Replies.retryDelayMillis(failure));
        assertFalse(verifier().isLocked(staff.uuid()), "se desbloquea al reintentar con exito");
    }

    @Test
    void onlyAnExplicitNeedsVerificationFalseUnlocks() throws IOException {
        start();
        api.reply("check_status", ok("{\"reason\":\"already_verified\"}")); // falta needs_verification

        join(staff);

        assertTrue(verifier().isLocked(staff.uuid()));
        assertEquals(0, api.count("generate_token"));
    }

    @Test
    void theStaffIsLockedBeforeAnyRequest() throws IOException {
        start();
        api.hold("check_status");

        join(staff);

        assertTrue(events.indexOf("lock:Staffer") >= 0);
        assertTrue(events.indexOf("lock:Staffer") < events.indexOf("api:check_status"));
    }

    @Test
    void aNickInTheStaffListIsLockedEvenWithoutPermissions() throws IOException {
        start();
        api.reply("get_staff", ok("{\"staff\":[{\"nick\":\"Mod\"}]}"));
        platform.advance(FurrSecurity.SYNC_MILLIS);
        api.hold("check_status");
        PlayerInfo bedrockImpostor = player(".mod", false);

        join(bedrockImpostor);

        assertTrue(verifier().isLocked(bedrockImpostor.uuid()));
    }

    @Test
    void aPlayerAddedToTheStaffListWhileOnlineIsLockedOnTheNextRefresh() throws IOException {
        start();
        PlayerInfo newModerator = player("NewMod", false);
        join(newModerator);
        assertFalse(verifier().isLocked(newModerator.uuid()));

        api.reply("get_staff", ok("{\"staff\":[{\"nick\":\"newmod\"}]}"));
        api.hold("check_status");
        platform.advance(FurrSecurity.SYNC_MILLIS);

        assertTrue(verifier().isLocked(newModerator.uuid()));
    }

    @Test
    void regularPlayersNeverReachTheApi() throws IOException {
        start();
        PlayerInfo regular = player("Regular", false);

        join(regular);
        verifier().onQuit(regular.uuid(), regular.handle());

        assertTrue(api.calls.isEmpty());
    }

    @Test
    void ipChangedRequiresANewLinkAndTheIpIsSent() throws IOException {
        start();
        api.reply("check_status", ok("{\"needs_verification\":true,\"reason\":\"ip_changed\"}"))
                .reply("generate_token", ok(TOKEN)).always("verify_token_status", ok(PENDING));

        join(staff);

        assertTrue(verifier().isLocked(staff.uuid()));
        assertEquals(staff.ip(), api.last("check_status").form().get("ip"));
        assertEquals(staff.ip(), api.last("generate_token").form().get("ip"));
        assertTrue(events.contains("msg:Staffer:FurrSecurity | Haz click para verificar: https://fg.test/verify.php?token=t1"));
        assertTrue(events.stream().anyMatch(event -> event.startsWith("broadcast:furrsecurity.notify:")));
    }

    @Test
    void anExpiredTokenKicksFirstRecordsTheFailureAfterAndKeepsTheLockUntilQuit() throws IOException {
        start();
        joinWithPendingToken();
        api.reply("verify_token_status", ok("{\"status\":\"token_expired\",\"verified\":false}"))
                .reply("record_failed_attempt", ok("{\"success\":true,\"failed_attempts\":1,\"blacklisted\":false}"));

        platform.advance(POLL);

        int kick = events.indexOf("kick:Staffer");
        int record = events.indexOf("api-once:record_failed_attempt");
        assertTrue(kick >= 0 && kick < record, "orden: " + events);
        assertTrue(verifier().isLocked(staff.uuid()));
        assertFalse(events.contains("unlock:Staffer"));

        verifier().onQuit(staff.uuid(), staff.handle());

        assertFalse(verifier().isLocked(staff.uuid()));
        FakeApi.Call disconnect = api.last("player_disconnect");
        assertTrue(disconnect.once());
        assertEquals("1", disconnect.form().get("locked"));
    }

    @Test
    void aVerifiedTokenUnlocksAndStartsTheSession() throws IOException {
        start();
        joinWithPendingToken();
        api.reply("verify_token_status", ok("{\"status\":\"verified\",\"verified\":true,\"time_remaining_seconds\":28800}"));

        platform.advance(POLL);

        assertFalse(verifier().isLocked(staff.uuid()));
        assertEquals(VerificationManager.Status.VERIFIED, verifier().status(staff.uuid()).orElseThrow());
        assertTrue(verifier().sessionSeconds(staff.uuid()) > 28_000);
    }

    @Test
    void aTokenThatIsNotFoundRestartsTheFlowAndFinallyKicks() throws IOException {
        start();
        api.always("check_status", ok(NO_SESSION)).always("generate_token", ok(TOKEN))
                .always("verify_token_status", ok("{\"status\":\"not_found\",\"verified\":false}"));

        join(staff);
        for (int i = 0; i < 4; i++) {
            platform.advance(POLL);
        }

        assertEquals(4, api.count("generate_token"));
        assertTrue(events.contains("kick:Staffer"));
        assertTrue(verifier().isLocked(staff.uuid()));
    }

    @Test
    void aPollIsNotSentWhileThePreviousOneIsInFlight() throws IOException {
        start();
        joinWithPendingToken();
        CompletableFuture<ApiResult> inFlight = api.hold("verify_token_status");

        platform.advance(POLL);
        platform.advance(POLL);
        assertEquals(1, api.count("verify_token_status"));

        inFlight.complete(ok(PENDING));
        platform.advance(POLL);
        assertEquals(2, api.count("verify_token_status"));
    }

    @Test
    void lockedPlayersCannotRunAnyCommandAndResetNeverUnlocks() throws IOException {
        start();
        api.reply("check_status", ok(VERIFIED));
        join(staff);
        assertFalse(verifier().isLocked(staff.uuid()));

        // /fsec reset Staffer ejecutado por el propio Staffer (por ejemplo desde consola compartida)
        api.reply("reset_session", failure(Kind.SERVER_ERROR));
        List<String> replies = new ArrayList<>();
        new FurrSecurityCommand(core).execute(sender(replies), new String[]{"reset", "Staffer"});

        assertTrue(verifier().isLocked(staff.uuid()), "bloqueado al momento, antes de la respuesta");
        assertTrue(core.settings().lockCommands(), "con el bloqueo, ningun comando pasa: tampoco /fsec");
        assertTrue(replies.stream().anyMatch(reply -> reply.contains("sigue bloqueado")));

        // el reintento repite el reseteo (no un check_status que le devolveria la sesion)
        api.reply("reset_session", ok("{\"success\":true,\"sessions_expired\":1}"))
                .reply("generate_token", ok(TOKEN)).always("verify_token_status", ok(PENDING));
        platform.advance(Replies.retryDelayMillis(failure(Kind.SERVER_ERROR)));

        assertEquals(1, api.count("check_status"), "solo el check de la entrada");
        assertEquals(1, api.count("generate_token"));
        assertTrue(verifier().isLocked(staff.uuid()));
    }

    @Test
    void anOldCheckStatusAnswerCannotUnlockAfterAReset() throws IOException {
        start();
        CompletableFuture<ApiResult> oldAnswer = api.hold("check_status");
        join(staff);
        api.reply("reset_session", ok("{\"success\":true,\"sessions_expired\":1}"))
                .reply("generate_token", ok(TOKEN)).always("verify_token_status", ok(PENDING));
        verifier().reset(staff, result -> { });

        oldAnswer.complete(ok(VERIFIED));

        assertTrue(verifier().isLocked(staff.uuid()));
    }

    @Test
    void theSessionExpiryLocksAgainAndAsksForANewLink() throws IOException {
        start();
        api.reply("check_status", ok(VERIFIED));
        join(staff);
        api.reply("generate_token", ok(TOKEN)).always("verify_token_status", ok(PENDING));

        platform.advance(3_600_000);

        assertTrue(verifier().isLocked(staff.uuid()));
        assertEquals(1, api.count("generate_token"));
        assertTrue(events.stream().anyMatch(event -> event.startsWith("msg:Staffer:FurrSecurity | Tu sesion expira en")));
    }

    @Test
    void earlyReVerificationExtendsTheSessionWithoutLocking() throws IOException {
        start();
        api.reply("check_status", ok(VERIFIED.replace("3600", "400")));
        join(staff);
        api.reply("generate_token", ok(TOKEN))
                .reply("verify_token_status", ok("{\"status\":\"verified\",\"verified\":true,\"time_remaining_seconds\":28800}"));

        platform.advance(100_000 + POLL); // aviso de los 300 s (dentro de early-verify-time) y un sondeo

        assertFalse(verifier().isLocked(staff.uuid()));
        assertTrue(verifier().sessionSeconds(staff.uuid()) > 28_000);
    }

    @Test
    void aJoinBeforeTheCoreIsEnabledStaysLockedAndProceedsOnceItIs() {
        platform = new FakePlatform(events, true);
        api = new FakeApi(events);
        core = new FurrSecurity(PluginLogger.of(message -> { }, message -> { }, (message, error) -> { }),
                dataDirectory, platform, apiConfig -> api);

        join(staff);
        assertTrue(verifier().isLocked(staff.uuid()));
        assertEquals(0, api.count("check_status"), "sin cliente todavia: no sale nada a la red");

        api.reply("check_status", ok(VERIFIED));
        core.enable();
        platform.advance(0);

        assertFalse(verifier().isLocked(staff.uuid()));
    }

    @Test
    void resettingAPlayerWhoJustLeftOnlyResetsTheSessionInTheApi() throws IOException {
        start();
        api.reply("reset_session", ok("{\"success\":true,\"sessions_expired\":1}"));
        List<ApiResult> replies = new ArrayList<>();

        verifier().reset(staff, replies::add); // nunca entro (o ya salio): no hay estado vivo

        assertEquals(1, replies.size());
        assertFalse(verifier().isLocked(staff.uuid()));
        assertEquals(1, platform.pendingTasks(), "solo queda la sincronizacion periodica, ningun sondeo");
    }

    @Test
    void aReloadRetriesPendingChecksRightAwayWithTheNewClient() throws IOException {
        start();
        api.reply("check_status", failure(Kind.UNAUTHORIZED)); // clave mala: reintento en 60 s
        join(staff);

        api.reply("check_status", ok(VERIFIED));
        core.reload();
        platform.advance(0);

        assertFalse(verifier().isLocked(staff.uuid()));
    }

    @Test
    void proxyModeWaitsForTheProxyWithoutLinksKicksOrDisconnectReports() throws IOException {
        start("proxy-mode: true\n");
        api.reply("check_status", ok(NO_SESSION));

        join(staff);
        api.reply("check_status", ok(VERIFIED));
        platform.advance(POLL);

        assertFalse(verifier().isLocked(staff.uuid()));
        assertEquals(0, api.count("generate_token"));
        verifier().onQuit(staff.uuid(), staff.handle());
        assertEquals(0, api.count("player_disconnect"));
    }

    private static PlayerInfo player(String nick, boolean staffPermission) {
        return new PlayerInfo(UUID.nameUUIDFromBytes(nick.getBytes()), nick, "203.0.113.7", staffPermission, new Object());
    }

    private static FurrSecurityCommand.Sender sender(List<String> replies) {
        return new FurrSecurityCommand.Sender() {
            @Override
            public void sendMessage(Component message) {
                replies.add(FakePlatform.plain(message));
            }

            @Override
            public boolean hasPermission(String permission) {
                return true;
            }
        };
    }
}
