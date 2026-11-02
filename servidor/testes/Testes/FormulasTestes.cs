using System.Text.Json;
using ReinoDePedra.Jogo.Config;

namespace ReinoDePedra.Testes;

/// <summary>As fórmulas do servidor batem com as de balanceamento/modelo.js (valores de "referencia" do config.json).</summary>
public class FormulasTestes
{
    private static readonly Balanceamento B = Balanceamento.Padrao;
    private static readonly Formulas F = new(B);
    private static JsonElement Ref(string n) => B.Referencia.GetProperty(n);
    private static void Perto(double esperado, double real, double tol = 1e-9) =>
        Assert.True(Math.Abs(esperado - real) <= tol * Math.Max(1, Math.Abs(esperado)), $"esperado {esperado}, veio {real}");
    private static Dictionary<string, int> Grupo(JsonElement e) => e.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt32());

    [Fact]
    public void Metas_do_modelo_no_alvo() => Assert.True(Ref("metasOk").GetBoolean());

    [Fact]
    public void Producao_castelo_custo_e_tempo_por_nivel()
    {
        for (var L = 1; L <= B.P.NivelMax; L++)
        {
            Perto(Ref("producao")[L - 1].GetDouble(), F.Producao(L));
            Perto(Ref("castelo")[L - 1].GetDouble(), F.ProducaoCastelo(L));
            if (L < 2) continue;
            Perto(Ref("custo")[L - 1].GetDouble(), F.Custo(L));
            Perto(Ref("tempoObra")[L - 1].GetDouble(), F.TempoObra(L));
            var rec = Ref("receita")[L - 1];
            foreach (var (k, v) in F.Receita(F.Custo(L))) Perto(rec.GetProperty(k).GetDouble(), v);
        }
    }

    [Fact]
    public void Moradia_e_novo_local()
    {
        foreach (var x in Ref("moradia").EnumerateArray())
        {
            var n = x.GetProperty("n").GetInt32();
            Perto(x.GetProperty("custo").GetDouble(), F.CustoMoradia(n));
            Perto(x.GetProperty("tempo").GetDouble(), F.TempoMoradia(n));
        }
        foreach (var x in Ref("novoLocal").EnumerateArray())
            foreach (var (k, v) in F.CustoNovoLocal(x.GetProperty("n").GetInt32()))
                Perto(x.GetProperty("custo").GetProperty(k).GetDouble(), v);
    }

    [Fact]
    public void Viagem()
    {
        foreach (var x in Ref("viagem").EnumerateArray())
            Perto(x.GetProperty("min").GetDouble(), F.ViagemMin(x.GetProperty("hexes").GetDouble(), x.GetProperty("vel").GetString()!, x.GetProperty("rota").GetBoolean()));
    }

    [Fact]
    public void Combates_de_referencia()
    {
        foreach (var c in Ref("batalhas").EnumerateArray())
        {
            var x = c.GetProperty("extra");
            double G(string n) => x.TryGetProperty(n, out var v) ? v.GetDouble() : 0;
            var extra = new ExtraDefesa
            {
                Pop = G("pop"), ArqTorre = G("arqTorre"), Reliquia = G("reliquia"), BonusD = G("bonusD"), BonusA = G("bonusA"), Portoes = (int)G("portoes"),
            };
            double? lim = c.GetProperty("limite").ValueKind == JsonValueKind.Null ? null : c.GetProperty("limite").GetDouble();
            var r = F.Batalha(Grupo(c.GetProperty("atk")), Grupo(c.GetProperty("def")), extra, lim);
            var e = c.GetProperty("res");
            Perto(e.GetProperty("A").GetDouble(), Formulas.ArredJs(r.A), 0);
            Perto(e.GetProperty("D").GetDouble(), Formulas.ArredJs(r.D), 0);
            Assert.Equal(e.GetProperty("venceA").GetBoolean(), r.VenceA);
            Assert.Equal(e.GetProperty("recuou").GetBoolean(), r.Recuou);
            Perto(e.GetProperty("perdaA").GetDouble(), r.PerdaA);
            Perto(e.GetProperty("perdaD").GetDouble(), r.PerdaD);
        }
    }

    [Fact]
    public void Extracao_espionagem_fauna_torres()
    {
        foreach (var x in Ref("extracao").EnumerateArray())
            Perto(x.GetProperty("valorH").GetDouble(), F.ExtracaoH(Grupo(x.GetProperty("grupo")), x.GetProperty("posto").GetBoolean(), x.GetProperty("rota").GetBoolean()));
        foreach (var x in Ref("espiao").EnumerateArray())
            Perto(x.GetProperty("chance").GetDouble(), F.ChanceEspiao(x.GetProperty("torres").GetInt32(), x.GetProperty("tropas").GetInt32()));
        foreach (var x in Ref("fauna").EnumerateArray())
            Assert.Equal(x.GetProperty("risco").GetString(), F.RiscoFauna(x.GetProperty("nivel").GetString()!, x.GetProperty("forca").GetDouble()));
        foreach (var x in Ref("forcaFauna").EnumerateArray())
            Perto(x.GetProperty("forca").GetDouble(), F.ForcaFauna(Grupo(x.GetProperty("grupo"))));
        foreach (var x in Ref("torres").EnumerateArray())
        {
            var n = x.GetProperty("nivel").GetInt32();
            Assert.Equal(x.GetProperty("alcance").GetInt32(), F.AlcanceTorre(n));
            Perto(x.GetProperty("tempo").GetDouble(), F.TempoTorre(n));
            foreach (var (k, v) in F.CustoTorre(n)) Perto(x.GetProperty("custo").GetProperty(k).GetDouble(), v);
        }
    }

    [Fact]
    public void Config_do_servidor_esta_em_dia_com_o_modelo()
    {
        // se o modelo mudou e alguém esqueceu de rodar --json, este teste falha (precisa de node no PATH)
        var raiz = Path.GetDirectoryName(Path.GetDirectoryName(Balanceamento.Localizar()))!;
        var modelo = Path.Combine(raiz, "balanceamento", "modelo.js");
        string saida;
        try
        {
            var p = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("node", [modelo, "--json"]) { RedirectStandardOutput = true, UseShellExecute = false })!;
            saida = p.StandardOutput.ReadToEnd(); p.WaitForExit();
        }
        catch (System.ComponentModel.Win32Exception) { return; }   // sem node: pula
        var atual = File.ReadAllText(Balanceamento.Localizar());
        Assert.True(saida.Trim() == atual.Trim(), "balanceamento/config.json desatualizado: rode node balanceamento/modelo.js --json > balanceamento/config.json");
    }
}
