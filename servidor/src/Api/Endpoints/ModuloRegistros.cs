using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoPreferencias(Dictionary<string, bool> Categorias);

/// <summary>Relatórios e notificações do reino.</summary>
public sealed class ModuloRegistros : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/relatorios", async (string? tipo, long? antes, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return m.Relatorios.Where(x => x.ReinoId == r.Id && (tipo == null || x.Tipo == tipo) && (antes == null || x.Id < antes))
                    .OrderByDescending(x => x.Id).Take(50)
                    .Select(x => new RelatoriosJson(x.Id, x.Tipo, x.Titulo, x.Quando, x.Lido, resumo: x.Dados["resumo"]?.ToString())).ToList();
            }), Json.Web);
        });
        conta.MapGet("/relatorios/{rid:long}", async (long rid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var x = m.Relatorios.Obter(rid);
                if (x == null || x.ReinoId != r.Id) throw new RegraException("Relatório não encontrado.", 404);
                if (!x.Lido) { x.Lido = true; m.Sujar(x); }
                return new Relatorios2Json(x.Id, x.Tipo, x.Titulo, x.Quando, dados: x.Dados);
            }), Json.Web);
        });
        conta.MapGet("/notificacoes", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var lista = m.Notificacoes.Where(x => x.ReinoId == r.Id).OrderByDescending(x => x.Id).Take(100)
                    .Select(x => new RegistrosListaJson(x.Id, x.Categoria, x.Titulo, x.Texto, x.Link, x.Quando, x.Lida, tamanho: TamanhoAviso.Da(x), acao: x.Acao)).ToList();
                return new NotificacoesJson(naoLidas: m.Notificacoes.Count(x => x.ReinoId == r.Id && !x.Lida), itens: lista);
            }), Json.Web);
        });
        conta.MapPost("/notificacoes/lidas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                foreach (var n in m.Notificacoes.Where(x => x.ReinoId == r.Id && !x.Lida)) { n.Lida = true; m.Sujar(n); }
            });
            return Results.NoContent();
        });
        conta.MapGet("/notificacoes/preferencias", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return Registros.Categorias.Select(kv => new NotificacoesPreferenciasJson(id: kv.Key, nome: kv.Value, ligada: !r.NotificacoesDesligadas.Contains(kv.Key))).ToList();
            }), Json.Web);
        });
        conta.MapPut("/notificacoes/preferencias", async (PedidoPreferencias p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                foreach (var (k, v) in p.Categorias ?? new())
                {
                    if (!Registros.Categorias.ContainsKey(k)) continue;
                    if (v) r.NotificacoesDesligadas.Remove(k); else r.NotificacoesDesligadas.Add(k);
                }
                m.Sujar(r);
            });
            return Results.NoContent();
        });
    }
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record RelatoriosJson(long Id, string Tipo, string Titulo, long Quando, bool Lido, string? resumo);
public sealed record Relatorios2Json(long Id, string Tipo, string Titulo, long Quando, System.Text.Json.Nodes.JsonObject dados);
public sealed record RegistrosListaJson(long Id, string Categoria, string Titulo, string? Texto, string? Link, long Quando, bool Lida, string tamanho, System.Text.Json.Nodes.JsonObject? acao);
public sealed record NotificacoesJson(int naoLidas, List<RegistrosListaJson> itens);
public sealed record NotificacoesPreferenciasJson(string id, string nome, bool ligada);
