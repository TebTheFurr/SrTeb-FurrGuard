package org.grinch.furrsecurity;

import org.grinch.furrguard.common.config.YamlConfig;
import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiClientConfig;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrguard.common.log.PluginLogger;
import org.grinch.furrsecurity.api.Api;
import org.grinch.furrsecurity.api.Replies;
import org.grinch.furrsecurity.config.Settings;
import org.grinch.furrsecurity.manager.VerificationManager;
import org.grinch.furrsecurity.platform.PlatformHandler;
import org.grinch.furrsecurity.platform.PlatformHandler.TaskHandle;
import org.grinch.furrsecurity.util.Messages;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Nucleo de FurrSecurity, comun a Velocity y Paper: configuracion, cliente de la API, ajustes, mensajes,
 * lista de staff y verificacion. Obliga al staff a verificar su identidad con Discord y falla en cerrado.
 */
public final class FurrSecurity {

    static final String CONFIG_FILE = "config.yml";
    static final String DEFAULT_API_URL = "https://furrguard.srteb.eu/api/furrsecurity.php";
    static final long SYNC_MILLIS = 60_000;

    private final PluginLogger logger;
    private final Path configPath;
    private final PlatformHandler platform;
    private final Function<ApiClientConfig, Api> apiFactory;

    private volatile YamlConfig config = YamlConfig.empty();
    private volatile Api api = Api.unavailable("FurrSecurity aun no ha arrancado");
    private volatile List<String> apiProblems = List.of();
    private volatile Settings localSettings = Settings.fromYaml(YamlConfig.empty());
    private volatile Map<String, String> remoteSettings;
    private volatile Settings settings = localSettings;
    private volatile Messages messages = Messages.defaults();
    private volatile Set<String> staff = Set.of();
    private volatile Boolean syncHealthy;
    private final VerificationManager verifier;
    private TaskHandle syncTask;

    public FurrSecurity(PluginLogger logger, Path dataDirectory, PlatformHandler platform) {
        this(logger, dataDirectory, platform, apiConfig -> Api.of(new ApiClient(apiConfig)));
    }

    public FurrSecurity(PluginLogger logger, Path dataDirectory, PlatformHandler platform,
                        Function<ApiClientConfig, Api> apiFactory) {
        this.logger = logger;
        this.configPath = dataDirectory.resolve(CONFIG_FILE);
        this.platform = platform;
        this.apiFactory = apiFactory;
        this.verifier = new VerificationManager(this); // nunca nulo: un evento temprano bloquea y reintenta
    }

    /** Nada bloqueante: la lista de staff, los ajustes y los mensajes llegan en segundo plano. */
    public void enable() {
        YamlConfig.LoadResult loaded = YamlConfig.load(configPath, FurrSecurity.class.getClassLoader(), CONFIG_FILE);
        if (!loaded.ok()) {
            logger.error("config.yml no valido (" + loaded.error() + "): se usan los valores por defecto y el staff"
                    + " quedara bloqueado hasta corregirlo y ejecutar /fsec reload");
        }
        config = loaded.config();
        applyConfig();
        verifier.retryPendingNow(); // quien entrase antes de arrancar fallo con el cliente provisional
        platform.runOnMain(verifier::adoptOnlinePlayers);
        syncTask = platform.repeat(this::sync, 0, SYNC_MILLIS);
        logger.info("FurrSecurity " + BuildConstants.VERSION + " activo en " + platform.name()
                + (isProxyMode() ? " (modo proxy)" : "") + (isEnabled() ? "" : " - DESACTIVADO en config.yml"));
    }

    /**
     * Relee config.yml, reconstruye el cliente (URL y clave) y vuelve a pedir staff, ajustes y mensajes.
     * Si config.yml no es valido se conserva la configuracion anterior.
     *
     * @return problemas para mostrar al administrador; vacia si todo fue bien
     */
    public List<String> reload() {
        YamlConfig.LoadResult loaded = YamlConfig.load(configPath, FurrSecurity.class.getClassLoader(), CONFIG_FILE);
        if (!loaded.ok()) {
            return List.of("config.yml no valido, se mantiene el anterior: " + loaded.error());
        }
        config = loaded.config();
        applyConfig();
        verifier.retryPendingNow();
        sync();
        return apiProblems;
    }

    public void disable() {
        if (syncTask != null) {
            syncTask.cancel();
        }
        verifier.shutdown();
        api.close();
    }

    // ---- consultas ----

    public PluginLogger logger() {
        return logger;
    }

    public PlatformHandler platform() {
        return platform;
    }

    public Api api() {
        return api;
    }

    public Settings settings() {
        return settings;
    }

    public Messages messages() {
        return messages;
    }

    public VerificationManager verifier() {
        return verifier;
    }

    public boolean isEnabled() {
        return config.bool("enabled", true);
    }

    /** Paper detras de un Velocity con FurrSecurity: se bloquea y se espera, sin generar enlaces ni expulsar. */
    public boolean isProxyMode() {
        return !platform.isProxy() && config.bool("proxy-mode", false);
    }

    public boolean isListedStaff(String nick) {
        return staff.contains(Replies.normalizeNick(nick));
    }

    public int listedStaffCount() {
        return staff.size();
    }

    public List<String> apiProblems() {
        return apiProblems;
    }

    /** {@code null} hasta la primera respuesta de {@code get_staff}. */
    public Boolean isSyncHealthy() {
        return syncHealthy;
    }

    // ---- interno ----

    private void applyConfig() {
        ApiClientConfig apiConfig = ApiClientConfig.builder(config.string("api.url", DEFAULT_API_URL), config.string("api.key", ""))
                .userAgent("FurrSecurity/" + BuildConstants.VERSION)
                .build();
        apiProblems = ApiClient.validateConfig(apiConfig);
        if (!apiProblems.isEmpty()) {
            logger.error("API de FurrSecurity mal configurada (" + String.join("; ", apiProblems)
                    + "): el staff seguira bloqueado hasta corregir config.yml");
        }
        Api previous = api;
        api = apiFactory.apply(apiConfig);
        if (previous != null) {
            previous.close(); // sus llamadas pendientes terminan como fallo y se reintentan con el cliente nuevo
        }
        localSettings = Settings.fromYaml(config);
        Map<String, String> remote = remoteSettings;
        settings = remote == null ? localSettings : localSettings.withApi(remote);
    }

    private void sync() {
        Api client = api;
        client.post("get_staff", Map.of()).thenAccept(result -> {
            Set<String> nicks = Replies.staffNicks(result);
            reportSync(nicks != null, result);
            if (nicks != null) {
                staff = nicks;
                platform.runOnMain(verifier::sweep);
            }
        });
        client.post("get_settings", Map.of()).thenAccept(result -> {
            if (result instanceof Success ok) {
                Map<String, String> remote = Json.stringMap(ok.body());
                remoteSettings = remote;
                settings = localSettings.withApi(remote);
            }
        });
        client.post("get_messages", Map.of()).thenAccept(result -> {
            if (result instanceof Success ok) {
                messages = Messages.defaults().withOverrides(Json.stringMap(ok.body()));
            }
        });
    }

    private void reportSync(boolean healthy, ApiResult result) {
        Boolean previous = syncHealthy;
        syncHealthy = healthy;
        if (!healthy && !Boolean.FALSE.equals(previous)) {
            logger.warn("No se pudo actualizar la lista de staff (" + Replies.describe(result)
                    + "): se mantiene la anterior y el staff con permisos sigue bloqueandose al entrar");
        } else if (healthy && Boolean.FALSE.equals(previous)) {
            logger.info("Conexion con la API de FurrSecurity recuperada");
        }
    }
}
