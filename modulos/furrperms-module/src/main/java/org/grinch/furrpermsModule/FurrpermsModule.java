package org.grinch.furrpermsModule;

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import org.grinch.furrguard.common.config.YamlConfig;
import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiClientConfig;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrpermsModule.config.Config;
import org.grinch.furrpermsModule.listener.CommandListener;
import org.grinch.furrpermsModule.util.MessageUtil;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Plugin(
        id = "furrperms-module",
        name = "FurrPerms Module",
        version = BuildConstants.VERSION,
        description = "Módulo de protección de comandos sensibles para FurrGuard",
        authors = {"GrinchHorizon"},
        url = "https://tebby.lgbt"
)
public final class FurrpermsModule {

    private static final long MESSAGES_REFRESH_MINUTES = 5;

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private final MessageUtil messages = new MessageUtil();
    private ApiClient api;
    private ScheduledTask messagesTask;

    @Inject
    public FurrpermsModule(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        YamlConfig.LoadResult loaded = YamlConfig.load(dataDirectory.resolve("config.yml"),
                FurrpermsModule.class.getClassLoader(), "config.yml");
        if (!loaded.ok()) {
            logger.error("config.yml no valido ({}): se usan los valores por defecto", loaded.error());
        }
        Config config = Config.from(loaded.config());
        if (!config.enabled()) {
            logger.warn("FurrPerms esta desactivado en config.yml: los comandos de permisos NO estan protegidos");
            return;
        }

        ApiClientConfig apiConfig = ApiClientConfig.builder(config.apiUrl(), config.apiKey())
                .userAgent("FurrPerms/" + BuildConstants.VERSION)
                .build();
        List<String> problems = ApiClient.validateConfig(apiConfig);
        if (!problems.isEmpty()) {
            logger.error("API de FurrGuard mal configurada ({}): se deniegan todos los comandos protegidos",
                    String.join("; ", problems));
        }
        ApiClient client = new ApiClient(apiConfig);
        api = client;

        CommandListener.Api commands = new CommandListener.Api() {
            @Override
            public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
                return client.post(action, form);
            }

            @Override
            public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
                return client.postOnce(action, form);
            }
        };
        server.getEventManager().register(this, new CommandListener(config, commands, messages, server, logger));
        messagesTask = server.getScheduler().buildTask(this, this::refreshMessages)
                .repeat(MESSAGES_REFRESH_MINUTES, TimeUnit.MINUTES)
                .schedule();
        logger.info("FurrPerms {} protegiendo {} comandos de permisos", BuildConstants.VERSION, config.protectedLabels().size());
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (messagesTask != null) {
            messagesTask.cancel();
        }
        if (api != null) {
            api.close();
        }
    }

    private void refreshMessages() {
        api.post("get_messages", Map.of()).thenAccept(result -> {
            if (result instanceof Success ok) {
                messages.apply(Json.stringMap(ok.body()));
            }
        });
    }
}
