package org.grinch.furrguard.common.text;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.Style;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SafeTextTest {

    /** Trozo de texto visible con su estilo efectivo (heredado de los padres). */
    private record Piece(String text, TextColor color, boolean bold) {
    }

    private static List<Piece> pieces(Component component) {
        List<Piece> out = new ArrayList<>();
        collect(component, Style.empty(), out);
        return out;
    }

    private static void collect(Component component, Style parent, List<Piece> out) {
        Style style = component.style().merge(parent, Style.Merge.Strategy.IF_ABSENT_ON_TARGET);
        if (component instanceof TextComponent text && !text.content().isEmpty()) {
            out.add(new Piece(text.content(), style.color(),
                    style.decoration(TextDecoration.BOLD) == TextDecoration.State.TRUE));
        }
        for (Component child : component.children()) {
            collect(child, style, out);
        }
    }

    private static String plain(Component component) {
        return pieces(component).stream().map(Piece::text).collect(Collectors.joining());
    }

    private static Piece pieceContaining(Component component, String text) {
        return pieces(component).stream().filter(p -> p.text().contains(text)).findFirst()
                .orElseThrow(() -> new AssertionError("no hay trozo con '" + text + "' en " + pieces(component)));
    }

    @Test
    void legacyCodesInValuesDoNotChangeStyle() {
        Component result = SafeText.render("&cHola {nick} adios",
                Map.of("nick", "&aVerde§lNegrita"));

        assertEquals("Hola &aVerde&lNegrita adios", plain(result));
        for (Piece piece : pieces(result)) {
            assertEquals(NamedTextColor.RED, piece.color(), "todo el mensaje sigue en rojo: " + piece);
            assertTrue(!piece.bold(), "nadie activa negrita: " + piece);
        }
    }

    @Test
    void valueInheritsStyleActiveAtItsPosition() {
        Component result = SafeText.render("&7ISP: &c&l{isp}&r fin", Map.of("isp", "§aTelefonica"));

        Piece isp = pieceContaining(result, "Telefonica");
        assertEquals("&aTelefonica", isp.text());
        assertEquals(NamedTextColor.RED, isp.color());
        assertTrue(isp.bold());
        Piece end = pieceContaining(result, "fin");
        assertTrue(!end.bold() && end.color() == null, "&r despues del valor sigue funcionando: " + end);
    }

    @Test
    void templateSupportsSectionSignAndHexFormats() {
        assertEquals(NamedTextColor.RED, pieceContaining(SafeText.render("§cRojo"), "Rojo").color());
        assertEquals(TextColor.color(0x00FFAA),
                pieceContaining(SafeText.render("&#00FFAAHex {v}", Map.of("v", "valor")), "valor").color());
        assertEquals(TextColor.color(0x00FFAA),
                pieceContaining(SafeText.render("&x&0&0&F&F&A&A&l+ {v}", Map.of("v", "valor")), "valor").color());
    }

    @Test
    void controlAndInvisibleFormatCharactersCannotFakeLines() {
        Component result = SafeText.render("&7Comando: {command}",
                Map.of("command", "/lp\n&c[Consola] falso‮txet"));

        assertEquals("Comando: /lp &c[Consola] falsotxet", plain(result));
    }

    @Test
    void insertedValuesAreNotScannedAgain() {
        Map<String, String> values = new HashMap<>();
        values.put("a", "1 {b}");
        values.put("b", "SECRETO");
        values.put("n", null);

        Component result = SafeText.render("{a}|{b}|{n}|{desconocida}", values);

        assertEquals("1 {b}|SECRETO||{desconocida}", plain(result));
    }

    @Test
    void emptyTemplates() {
        assertEquals(Component.empty(), SafeText.render(null, Map.of()));
        assertEquals(Component.empty(), SafeText.render("", null));
        assertEquals("sin valores", plain(SafeText.render("sin valores", null)));
    }

    @Test
    void stripCodesRemovesLegacyAndHex() {
        assertEquals("Hola mundo x y z",
                SafeText.stripCodes("&cHola §l§Kmundo &#00FFAAx &x&0&0&F&F&A&Ay §x§0§0§f§f§a§az"));
        assertEquals("", SafeText.stripCodes(null));
        assertEquals("100 & 200", SafeText.stripCodes("100 & 200"));
    }
}
