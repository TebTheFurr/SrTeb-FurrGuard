package org.grinch.furrGuard.command;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrGuard.BuildConstants;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.license.LicenseManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class FurrGuardCommand implements SimpleCommand {

    private final FurrGuard plugin;
    private static final TextColor ACCENT = TextColor.color(0x00FFAA);
    private static final TextColor SECONDARY = TextColor.color(0x888888);
    private static final TextColor WARNING = TextColor.color(0xFFAA00);
    private static final TextColor SUCCESS = TextColor.color(0x55FF55);
    private static final TextColor ERROR = TextColor.color(0xFF5555);

    public FurrGuardCommand(FurrGuard plugin) {
        this.plugin = plugin;
    }

    @Override
    public void execute(Invocation invocation) {
        CommandSource source = invocation.source();
        String[] args = invocation.arguments();

        if (plugin.getLicenseManager() != null && !plugin.getLicenseManager().isLicensed()) {
            source.sendMessage(createMessage(ERROR, "El plugin no está verificado. Contacta con el administrador."));
            return;
        }

        if (!source.hasPermission("furrguard.admin")) {
            source.sendMessage(createMessage(ERROR, "No tienes permiso para usar este comando."));
            return;
        }

        if (args.length == 0) {
            sendMainHelp(source);
            return;
        }

        String subCommand = args[0].toLowerCase();

        switch (subCommand) {
            case "help" -> sendMainHelp(source);
            case "check" -> handleCheck(source, Arrays.copyOfRange(args, 1, args.length));
            case "reload" -> handleReload(source);
            case "status" -> handleStatus(source);
            case "cache" -> handleCache(source, Arrays.copyOfRange(args, 1, args.length));
            case "stats" -> handleStats(source);
            default -> {
                source.sendMessage(createMessage(ERROR, "Subcomando desconocido: &f" + subCommand));
                source.sendMessage(createMessage(SECONDARY, "Usa &a/fg help &7para ver los comandos disponibles."));
            }
        }
    }

    private void sendMainHelp(CommandSource source) {
        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" FurrGuard ")
                .color(ACCENT)
                .decorate(TextDecoration.BOLD)
                .append(Component.text("v" + BuildConstants.VERSION)
                        .color(SECONDARY))
                .append(Component.text(" ─ Sistema de Seguridad Anti-Proxy")
                        .color(TextColor.color(0x888888))));

        if (plugin.getLicenseManager() != null && plugin.getLicenseManager().isLicensed()) {
            LicenseManager.LicenseInfo license = plugin.getLicenseManager().getLicenseInfo();
            source.sendMessage(Component.text("   ")
                    .append(Component.text("✔ ")
                            .color(SUCCESS))
                    .append(Component.text("Licencia Activa")
                            .color(SUCCESS))
                    .append(Component.text(" ─ ")
                            .color(SECONDARY))
                    .append(Component.text(license.discord_username)
                            .color(TextColor.color(0xCCCCCC))));
        } else {
            source.sendMessage(Component.text("   ")
                    .append(Component.text("⚠ ")
                            .color(WARNING))
                    .append(Component.text("Licencia no verificada")
                            .color(WARNING)));
        }

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" Comandos:")
                .color(TextColor.color(0xFFFFFF))
                .decorate(TextDecoration.BOLD));

        sendCommandLine(source, "check <jugador>", "Verifica un jugador");
        sendCommandLine(source, "status", "Estado del sistema");
        sendCommandLine(source, "stats", "Estadísticas");
        sendCommandLine(source, "cache clear", "Limpiar caché");
        sendCommandLine(source, "reload", "Recargar config");
        sendCommandLine(source, "help", "Esta ayuda");

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" ─ Gestiona whitelist/blacklist desde el panel web")
                .color(TextColor.color(0x666666)));
        source.sendMessage(Component.empty());
    }

    private void sendCommandLine(CommandSource source, String command, String description) {
        source.sendMessage(Component.text("   ")
                .append(Component.text("/fg " + command)
                        .color(TextColor.color(0x55FFFF)))
                .append(Component.text(" ─ ")
                        .color(SECONDARY))
                .append(Component.text(description)
                        .color(TextColor.color(0xAAAAAA))));
    }

    private void handleReload(CommandSource source) {
        source.sendMessage(createMessage(ACCENT, "Recargando configuración..."));
        plugin.reload();
        source.sendMessage(createMessage(SUCCESS, "Configuración recargada correctamente."));
    }

    private void handleStatus(CommandSource source) {
        boolean apiConnected = plugin.getApiClient().testConnection();
        boolean cacheEnabled = plugin.getConfig().isCacheEnabled();
        boolean debugMode = plugin.getConfig().isDebug();
        boolean licensed = plugin.getLicenseManager() != null && plugin.getLicenseManager().isLicensed();

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" Estado del Sistema")
                .color(TextColor.color(0xFFFFFF))
                .decorate(TextDecoration.BOLD));

        source.sendMessage(Component.text("   Plugin: ")
                .append(Component.text(licensed ? "✔ Activo" : "✘ Inactivo")
                        .color(licensed ? SUCCESS : ERROR)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   API: ")
                .append(Component.text(apiConnected ? "✔ Conectado" : "✘ Desconectado")
                        .color(apiConnected ? SUCCESS : ERROR)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Caché: ")
                .append(Component.text(cacheEnabled ? "✔ Habilitada" : "⚠ Deshabilitada")
                        .color(cacheEnabled ? SUCCESS : WARNING)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Debug: ")
                .append(Component.text(debugMode ? "⚠ Activado" : "✔ Desactivado")
                        .color(debugMode ? WARNING : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Jugadores: ")
                .append(Component.text(String.valueOf(plugin.getServer().getPlayerCount()))
                        .color(TextColor.color(0xFFFFFF))));

        source.sendMessage(Component.empty());
    }

    private void handleCache(CommandSource source, String[] args) {
        if (args.length == 0) {
            source.sendMessage(createMessage(ERROR, "Uso: /fg cache <clear|info>"));
            return;
        }

        String action = args[0].toLowerCase();

        if (action.equals("clear")) {
            plugin.getApiClient().clearCache();
            source.sendMessage(createMessage(SUCCESS, "Caché limpiada correctamente."));
        } else if (action.equals("info")) {
            source.sendMessage(createMessage(ACCENT, "La caché está " +
                    (plugin.getConfig().isCacheEnabled() ? "habilitada" : "deshabilitada") +
                    " con duración de " + plugin.getConfig().getCacheDuration() + " segundos."));
        } else {
            source.sendMessage(createMessage(ERROR, "Acción desconocida: " + action));
        }
    }

    private void handleStats(CommandSource source) {
        int onlinePlayers = plugin.getServer().getPlayerCount();
        int maxPlayers = plugin.getServer().getConfiguration().getShowMaxPlayers();

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" Estadísticas")
                .color(TextColor.color(0xFFFFFF))
                .decorate(TextDecoration.BOLD));

        source.sendMessage(Component.text("   Jugadores: ")
                .append(Component.text(onlinePlayers + "/" + maxPlayers)
                        .color(TextColor.color(0xFFFFFF))));
        source.sendMessage(Component.text("   Servidores: ")
                .append(Component.text(String.valueOf(plugin.getServer().getAllServers().size()))
                        .color(TextColor.color(0xFFFFFF))));

        if (plugin.getLicenseManager() != null && plugin.getLicenseManager().isLicensed()) {
            LicenseManager.LicenseInfo license = plugin.getLicenseManager().getLicenseInfo();
            source.sendMessage(Component.text("   Licencia: ")
                    .append(Component.text(license.role != null ? license.role : "Estándar")
                            .color(ACCENT)));
        }

        source.sendMessage(Component.empty());
    }

    private void handleCheck(CommandSource source, String[] args) {
        if (args.length < 1) {
            source.sendMessage(createMessage(ERROR, "Uso: /fg check <jugador>"));
            return;
        }

        String playerName = args[0];
        Player target = plugin.getServer().getPlayer(playerName).orElse(null);

        if (target != null) {
            String ip = target.getRemoteAddress().getAddress().getHostAddress();
            String serverName = target.getCurrentServer()
                    .map(s -> s.getServerInfo().getName())
                    .orElse("Desconocido");
            source.sendMessage(createMessage(ACCENT, "Verificando &f" + target.getUsername() + " &7(online)..."));

            plugin.getApiClient().checkPlayer(
                    target.getUniqueId(),
                    target.getUsername(),
                    ip,
                    "Current"
            ).thenAccept(response -> sendCheckResult(source, target, ip, response, serverName));
        } else {
            source.sendMessage(createMessage(ACCENT, "Verificando &f" + playerName + " &7(offline)..."));

            plugin.getApiClient().lookupPlayer(playerName).thenAccept(result -> {
                if (result == null) {
                    source.sendMessage(createMessage(ERROR, "No se pudo conectar con la API."));
                    return;
                }
                if (result.has("error")) {
                    String error = result.get("error").getAsString();
                    if ("player_not_found".equals(error)) {
                        source.sendMessage(createMessage(ERROR, "Jugador no encontrado. Debe haber entrado al menos una vez."));
                    } else {
                        source.sendMessage(createMessage(ERROR, "Error: " + error));
                    }
                    return;
                }

                String uuid = result.has("uuid") ? result.get("uuid").getAsString() : "Desconocido";
                String nick = result.has("nick") ? result.get("nick").getAsString() : playerName;
                String ip = result.has("ip") ? result.get("ip").getAsString() : "Desconocido";

                String country = "Desconocido";
                String countryCode = "";
                String isp = "Desconocido";
                boolean proxy = false;
                boolean hosting = false;
                boolean mobile = false;

                if (result.has("ip_data") && !result.get("ip_data").isJsonNull()) {
                    com.google.gson.JsonObject ipData = result.getAsJsonObject("ip_data");
                    country = ipData.has("country") ? ipData.get("country").getAsString() : "Desconocido";
                    countryCode = ipData.has("countryCode") ? ipData.get("countryCode").getAsString() : "";
                    isp = ipData.has("isp") ? ipData.get("isp").getAsString() : "Desconocido";
                    proxy = ipData.has("proxy") && ipData.get("proxy").getAsBoolean();
                    hosting = ipData.has("hosting") && ipData.get("hosting").getAsBoolean();
                    mobile = ipData.has("mobile") && ipData.get("mobile").getAsBoolean();
                }

                boolean allowed = result.has("allowed") && result.get("allowed").getAsBoolean();
                String reason = result.has("reason") ? result.get("reason").getAsString() : null;

                sendOfflineCheckResult(source, nick, uuid, ip, country, countryCode, isp, proxy, hosting, mobile, allowed, reason);
            });
        }
    }

    private void sendOfflineCheckResult(CommandSource source, String name, String uuid, String ip,
                                        String country, String countryCode, String isp,
                                        boolean proxy, boolean hosting, boolean mobile,
                                        boolean allowed, String reason) {
        TextColor statusColor = allowed ? SUCCESS : ERROR;
        String statusIcon = allowed ? "✔" : "✘";

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" Verificación: ")
                .color(TextColor.color(0xAAAAAA))
                .append(Component.text(name)
                        .color(TextColor.color(0xFFFFFF))
                        .decorate(TextDecoration.BOLD))
                .append(Component.text(" (offline)")
                        .color(SECONDARY)));
        source.sendMessage(Component.text("   UUID: ")
                .append(Component.text(uuid.length() > 25 ? uuid.substring(0, 25) + "..." : uuid)
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   IP: ")
                .append(Component.text(ip)
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   País: ")
                .append(Component.text(country + (countryCode.isEmpty() ? "" : " (" + countryCode + ")"))
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   ISP: ")
                .append(Component.text(isp.length() > 30 ? isp.substring(0, 30) + "..." : isp)
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   Proxy: ")
                .append(Component.text(proxy ? "⚠ Sí" : "✔ No")
                        .color(proxy ? ERROR : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   VPN/Hosting: ")
                .append(Component.text(hosting ? "⚠ Sí" : "✔ No")
                        .color(hosting ? ERROR : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Móvil: ")
                .append(Component.text(mobile ? "⚠ Sí" : "✔ No")
                        .color(mobile ? WARNING : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Estado: ")
                .append(Component.text(statusIcon + " " + (allowed ? "PERMITIDO" : "BLOQUEADO"))
                        .color(statusColor)
                        .decorate(TextDecoration.BOLD)));
        if (!allowed && reason != null) {
            source.sendMessage(Component.text("   Razón: ")
                    .append(Component.text(formatReason(reason))
                            .color(WARNING)));
        }
        source.sendMessage(Component.empty());
    }

    private void sendCheckResult(CommandSource source, Player player, String ip,
                                 org.grinch.furrGuard.api.response.CheckPlayerResponse response, String serverName) {
        TextColor statusColor = response.isAllowed() ? SUCCESS : ERROR;
        String statusIcon = response.isAllowed() ? "✔" : "✘";
        String uuid = player.getUniqueId().toString();

        source.sendMessage(Component.empty());
        source.sendMessage(Component.text(" Verificación: ")
                .color(TextColor.color(0xAAAAAA))
                .append(Component.text(player.getUsername())
                        .color(TextColor.color(0xFFFFFF))
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Servidor: ")
                .append(Component.text(serverName)
                        .color(ACCENT)));
        source.sendMessage(Component.text("   UUID: ")
                .append(Component.text(uuid.length() > 25 ? uuid.substring(0, 25) + "..." : uuid)
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   IP: ")
                .append(Component.text(ip)
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   País: ")
                .append(Component.text(response.getCountry() != null ? response.getCountry() + " (" + (response.getCountryCode() != null ? response.getCountryCode() : "??") + ")" : "Desconocido")
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   ISP: ")
                .append(Component.text(response.getIsp() != null ? (response.getIsp().length() > 30 ? response.getIsp().substring(0, 30) + "..." : response.getIsp()) : "Desconocido")
                        .color(TextColor.color(0xCCCCCC))));
        source.sendMessage(Component.text("   Proxy: ")
                .append(Component.text(response.isProxy() ? "⚠ Sí" : "✔ No")
                        .color(response.isProxy() ? ERROR : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   VPN/Hosting: ")
                .append(Component.text(response.isHosting() ? "⚠ Sí" : "✔ No")
                        .color(response.isHosting() ? ERROR : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Móvil: ")
                .append(Component.text(response.isMobile() ? "⚠ Sí" : "✔ No")
                        .color(response.isMobile() ? WARNING : SUCCESS)
                        .decorate(TextDecoration.BOLD)));
        source.sendMessage(Component.text("   Estado: ")
                .append(Component.text(statusIcon + " " + (response.isAllowed() ? "PERMITIDO" : "BLOQUEADO"))
                        .color(statusColor)
                        .decorate(TextDecoration.BOLD)));
        if (!response.isAllowed() && response.getReason() != null) {
            source.sendMessage(Component.text("   Razón: ")
                    .append(Component.text(formatReason(response.getReason()))
                            .color(WARNING)));
        }
        source.sendMessage(Component.empty());
    }

    private String formatReason(String reason) {
        return switch (reason) {
            case "proxy_detected" -> "Proxy detectado";
            case "vpn_detected" -> "VPN detectada";
            case "hosting_detected" -> "Hosting/Datacenter";
            case "blocked_provider" -> "Proveedor bloqueado";
            case "blacklisted" -> "En lista negra";
            case "whitelisted" -> "En lista blanca";
            default -> reason;
        };
    }

    private Component createMessage(TextColor color, String message) {
        return Component.text(" ")
                .append(LegacyComponentSerializer.legacyAmpersand().deserialize(
                        (color == ERROR ? "§c✘ " : color == SUCCESS ? "§a✔ " : "§7➤ ") + message
                ));
    }

    @Override
    public List<String> suggest(Invocation invocation) {
        String[] args = invocation.arguments();
        List<String> suggestions = new ArrayList<>();

        if (args.length == 0 || args.length == 1) {
            String lastArg = args.length == 0 ? "" : args[0].toLowerCase();
            List<String> commands = List.of("check", "status", "reload", "cache", "stats", "help");
            for (String cmd : commands) {
                if (cmd.startsWith(lastArg)) {
                    suggestions.add(cmd);
                }
            }
        } else if (args.length == 2) {
            String subCmd = args[0].toLowerCase();
            if (subCmd.equals("check")) {
                String lastArg = args[1].toLowerCase();
                plugin.getServer().getAllPlayers().forEach(p -> {
                    if (p.getUsername().toLowerCase().startsWith(lastArg)) {
                        suggestions.add(p.getUsername());
                    }
                });
            } else if (subCmd.equals("cache")) {
                String lastArg = args[1].toLowerCase();
                for (String action : List.of("clear", "info")) {
                    if (action.startsWith(lastArg)) {
                        suggestions.add(action);
                    }
                }
            }
        }

        return suggestions;
    }

    @Override
    public boolean hasPermission(Invocation invocation) {
        if (plugin.getLicenseManager() != null && !plugin.getLicenseManager().isLicensed()) {
            return false;
        }
        return invocation.source().hasPermission("furrguard.admin");
    }
}
