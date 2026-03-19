package org.grinch.furrsecurity.command;

import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.command.CommandSource;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

import java.util.List;

/**
 * Velocity-specific command wrapper
 */
public class VelocityCommandWrapper implements SimpleCommand {

    private final FurrSecurityCommand command;

    public VelocityCommandWrapper(FurrSecurityCommand command) {
        this.command = command;
    }

    @Override
    public void execute(Invocation invocation) {
        CommandSource source = invocation.source();
        String[] args = invocation.arguments();

        command.handleCommand(new VelocitySenderWrapper(source), args);
    }

    @Override
    public List<String> suggest(Invocation invocation) {
        return command.handleTabComplete(invocation.arguments());
    }

    @Override
    public boolean hasPermission(Invocation invocation) {
        return invocation.source().hasPermission("furrsecurity.admin");
    }

    /**
     * Velocity command sender wrapper
     */
    private static class VelocitySenderWrapper implements FurrSecurityCommand.CommandSenderWrapper {
        private final CommandSource source;

        public VelocitySenderWrapper(CommandSource source) {
            this.source = source;
        }

        @Override
        public void sendMessage(String message) {
            Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(message);
            source.sendMessage(component);
        }

        @Override
        public boolean hasPermission(String permission) {
            return source.hasPermission(permission);
        }
    }
}
