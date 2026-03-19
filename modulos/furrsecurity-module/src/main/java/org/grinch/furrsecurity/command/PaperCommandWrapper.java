package org.grinch.furrsecurity.command;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.ChatColor;

import java.util.List;

/**
 * Paper-specific command wrapper
 */
public class PaperCommandWrapper implements CommandExecutor, TabCompleter {

    private final FurrSecurityCommand command;

    public PaperCommandWrapper(FurrSecurityCommand command) {
        this.command = command;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        command.handleCommand(new PaperSenderWrapper(sender), args);
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String alias, String[] args) {
        return command.handleTabComplete(args);
    }

    /**
     * Paper command sender wrapper
     */
    private static class PaperSenderWrapper implements FurrSecurityCommand.CommandSenderWrapper {
        private final CommandSender sender;

        public PaperSenderWrapper(CommandSender sender) {
            this.sender = sender;
        }

        @Override
        public void sendMessage(String message) {
            sender.sendMessage(ChatColor.translateAlternateColorCodes('&', message));
        }

        @Override
        public boolean hasPermission(String permission) {
            return sender.hasPermission(permission);
        }
    }
}
