package org.grinch.furrpermsModule.listener;

import com.google.gson.JsonParser;
import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.event.command.CommandExecuteEvent.CommandResult;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.grinch.furrguard.common.config.YamlConfig;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrpermsModule.config.Config;
import org.grinch.furrpermsModule.util.MessageUtil;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;

import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommandListenerTest {

    private static final String PROTECTED = "luckperms:lp user Bob permission set *";

    private final List<String> received = new ArrayList<>();
    private final List<Map.Entry<String, Map<String, String>>> calls = new ArrayList<>();
    private final Deque<CompletableFuture<ApiResult>> checks = new ArrayDeque<>();
    private final Player bob = player("Bob", Set.of());
    private final Player admin = player("Admin", Set.of(CommandListener.NOTIFY_PERMISSION));
    private final CommandListener listener = new CommandListener(Config.from(YamlConfig.empty()), api(),
            new MessageUtil(), fake(ProxyServer.class, "getAllPlayers", args -> List.of(bob, admin)), fake(Logger.class, null, null));

    @Test
    void commandsThatAreNotProtectedAreNotTouched() {
        CommandExecuteEvent event = new CommandExecuteEvent(bob, "lobby");

        assertNull(listener.onCommand(event));
        assertTrue(event.getResult().isAllowed());
        assertTrue(calls.isEmpty());
    }

    @Test
    void theConsoleIsNeverChecked() {
        CommandExecuteEvent event = new CommandExecuteEvent(fake(CommandSource.class, null, null), "lp user Bob");

        assertNull(listener.onCommand(event));
        assertTrue(event.getResult().isAllowed());
    }

    @Test
    void anApiFailureKeepsTheCommandDeniedAndIsLoggedWithTheIp() {
        checks.add(CompletableFuture.completedFuture(new Failure(Kind.TIMEOUT, 0, "x", 0)));
        CommandExecuteEvent event = new CommandExecuteEvent(bob, PROTECTED);

        assertNotNull(listener.onCommand(event));

        assertFalse(event.getResult().isAllowed());
        assertTrue(received.contains("Bob:✘ No se ha podido comprobar tu autorización. Inténtalo de nuevo en unos segundos."));
        Map<String, String> log = lastCall("log_furr_perms_command");
        assertEquals("0", log.get("allowed"));
        assertEquals("unavailable", log.get("reason"));
        assertEquals("203.0.113.7", log.get("ip_address"));
        assertEquals(Map.of("nick", "Bob", "uuid", uuid("Bob").toString(), "ip", "203.0.113.7"),
                lastCall("check_furr_perms_whitelist"));
    }

    @Test
    void aBugWhileDecidingLeavesTheCommandDenied() {
        checks.add(CompletableFuture.failedFuture(new IllegalStateException("fallo inesperado")));
        CommandExecuteEvent event = new CommandExecuteEvent(bob, PROTECTED);

        listener.onCommand(event);

        assertFalse(event.getResult().isAllowed());
    }

    @Test
    void anAllowedCommandKeepsItsResultAndTheGrantIsReusedWithoutAskingAgain() {
        checks.add(ok("{\"allowed\":true,\"reason\":\"ok\"}"));
        CommandExecuteEvent first = new CommandExecuteEvent(bob, PROTECTED);
        CommandExecuteEvent second = new CommandExecuteEvent(bob, "op Bob");

        listener.onCommand(first);
        assertNull(listener.onCommand(second), "concedido en cache: sin EventTask ni API");

        assertTrue(first.getResult().isAllowed());
        assertTrue(second.getResult().isAllowed());
        assertEquals(1, count("check_furr_perms_whitelist"));
        assertEquals(2, count("log_furr_perms_command"));
    }

    @Test
    void contractReasonsDenyWithAClearMessage() {
        checks.add(ok("{\"allowed\":false,\"reason\":\"needs_furrsecurity\"}"));
        CommandExecuteEvent event = new CommandExecuteEvent(bob, PROTECTED);

        listener.onCommand(event);

        assertFalse(event.getResult().isAllowed());
        assertTrue(received.contains("Bob:✘ Verifica tu identidad con FurrSecurity antes de usar /" + PROTECTED + "."));
    }

    @Test
    void aDenialCoolsDownWithoutCallingOrLoggingAgain() {
        checks.add(ok("{\"allowed\":false,\"reason\":\"not_whitelisted\"}"));

        listener.onCommand(new CommandExecuteEvent(bob, PROTECTED));
        CommandExecuteEvent again = new CommandExecuteEvent(bob, "deop Admin");
        assertNull(listener.onCommand(again));

        assertFalse(again.getResult().isAllowed());
        assertEquals(1, count("check_furr_perms_whitelist"));
        assertEquals(1, count("log_furr_perms_command"));
    }

    @Test
    void onlyPlayersWithTheNotifyPermissionAreNotified() {
        checks.add(ok("{\"allowed\":false,\"reason\":\"not_whitelisted\"}"));

        listener.onCommand(new CommandExecuteEvent(bob, PROTECTED));

        assertTrue(received.stream().anyMatch(message -> message.startsWith("Admin:[FurrPerms] ⚠ Bob intentó ejecutar /")));
        assertTrue(received.stream().noneMatch(message -> message.startsWith("Bob:[FurrPerms]")));
    }

    @Test
    void theCommandAnotherPluginRewroteIsTheOneChecked() {
        checks.add(ok("{\"allowed\":false,\"reason\":\"not_whitelisted\"}"));
        CommandExecuteEvent rewritten = new CommandExecuteEvent(bob, "hola");
        rewritten.setResult(CommandResult.command("op Bob"));

        listener.onCommand(rewritten);

        assertFalse(rewritten.getResult().isAllowed());
        assertEquals(1, count("check_furr_perms_whitelist"));
    }

    @Test
    void aCommandAlreadyDeniedByAnotherPluginIsNeitherCheckedNorLogged() {
        CommandExecuteEvent alreadyDenied = new CommandExecuteEvent(player("Carol", Set.of()), "op Carol");
        alreadyDenied.setResult(CommandResult.denied()); // p. ej. FurrSecurity con el jugador bloqueado

        assertNull(listener.onCommand(alreadyDenied));

        assertFalse(alreadyDenied.getResult().isAllowed());
        assertTrue(calls.isEmpty());
        assertTrue(received.isEmpty());
    }

    private CommandListener.Api api() {
        return new CommandListener.Api() {
            @Override
            public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
                calls.add(Map.entry(action, form));
                CompletableFuture<ApiResult> next = checks.poll();
                return next != null ? next : CompletableFuture.completedFuture(new Failure(Kind.NETWORK, 0, "x", 0));
            }

            @Override
            public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
                calls.add(Map.entry(action, form));
                return CompletableFuture.completedFuture(new Success(200, JsonParser.parseString("{\"success\":true}").getAsJsonObject()));
            }
        };
    }

    private long count(String action) {
        return calls.stream().filter(call -> call.getKey().equals(action)).count();
    }

    private Map<String, String> lastCall(String action) {
        return calls.stream().filter(call -> call.getKey().equals(action)).reduce((a, b) -> b).orElseThrow().getValue();
    }

    private static CompletableFuture<ApiResult> ok(String json) {
        return CompletableFuture.completedFuture(new Success(200, JsonParser.parseString(json).getAsJsonObject()));
    }

    private static UUID uuid(String nick) {
        return UUID.nameUUIDFromBytes(nick.getBytes());
    }

    private Player player(String nick, Set<String> permissions) {
        return (Player) Proxy.newProxyInstance(Player.class.getClassLoader(), new Class<?>[]{Player.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getUsername" -> nick;
                    case "getUniqueId" -> uuid(nick);
                    case "getRemoteAddress" -> new InetSocketAddress("203.0.113.7", 50000);
                    case "getCurrentServer" -> Optional.empty();
                    case "hasPermission" -> permissions.contains((String) args[0]);
                    case "sendMessage" -> {
                        for (Object arg : args) {
                            if (arg instanceof Component component) {
                                received.add(nick + ":" + PlainTextComponentSerializer.plainText().serialize(component));
                            }
                        }
                        yield null;
                    }
                    case "equals" -> proxy == args[0];
                    case "hashCode" -> System.identityHashCode(proxy);
                    default -> defaultValue(method.getReturnType());
                });
    }

    /** Doble minimo de una interfaz: responde {@code method} con {@code answer} y el resto con valores vacios. */
    private static <T> T fake(Class<T> type, String method, java.util.function.Function<Object[], Object> answer) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (proxy, invoked, args) -> invoked.getName().equals(method) ? answer.apply(args)
                        : invoked.getName().equals("hashCode") ? System.identityHashCode(proxy)
                        : invoked.getName().equals("equals") ? proxy == args[0]
                        : defaultValue(invoked.getReturnType())));
    }

    private static Object defaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == Optional.class) {
            return Optional.empty();
        }
        if (type.isPrimitive() && type != void.class) {
            return type == long.class ? 0L : type == double.class ? 0d : type == float.class ? 0f : 0;
        }
        return null;
    }
}
