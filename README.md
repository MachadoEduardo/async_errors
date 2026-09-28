# Exercícios 7 a 11 — execução e respostas

## Como executar

Use Node 18 ou superior. Nesta pasta, rode `npm install`, `npm run build` e `npm test`. Os comandos `npm run ex7`, `npm run ex10`, `npm run ex11:antes`, `npm run ex11:sem-timer` e `npm run ex11:depois` mostram os exemplos individualmente. `npm run server` inicia a API na porta 3000. O código do exercício 4 e o `launch.json` anterior não estavam nesta pasta; por isso foi criado um logger pequeno em `src/logger.ts` e uma configuração de depuração em `.vscode/launch.json`.

## 7. Erros assíncronos

**Sintoma e reprodução.** `node exemplos/exercicio7_antes.cjs` com `config/app.json` ausente terminou com código 1. Saída completa observada no Node v22.14.0:

```text
node:internal/fs/promises:638
  return new FileHandle(await PromisePrototypeThen(
                        ^

Error: ENOENT: no such file or directory, open 'C:\Users\05edu\Documents\LionsDev_Avancado\async_errors\config\app.json'
    at async open (node:internal/fs/promises:638:25)
    at async Object.readFile (node:internal/fs/promises:1242:14) {
  errno: -4058,
  code: 'ENOENT',
  syscall: 'open',
  path: 'C:\\Users\\05edu\\Documents\\LionsDev_Avancado\\async_errors\\config\\app.json'
}

Node.js v22.14.0
```

**Resultado esperado:** falha registrada e processo vivo. **Resultado obtido:** o `catch` não imprimiu nada; a promise rejeitada encerrou o processo antes dos 200 ms do timer. Em outra configuração de `unhandledRejection`, o Node pode emitir aviso em vez de encerrar. O evento `unhandledRejection` permite observar rejeições sem tratamento, mas a solução correta aqui é tratar a promise na origem.

**Hipótese e causa:** o `try` terminava logo depois de criar a promise; quando `readFile` rejeitava, já não estava dentro daquele fluxo síncrono. O callback de `setTimeout` também executa depois que `retryLater` terminou: um `throw` ali não volta ao `try` do chamador. O código `ENOENT` identifica arquivo ausente; JSON inválido lança `SyntaxError`.

**Ferramenta e correção:** terminal, stack completo com `console.error(error)` e código `ENOENT`. Em `src/exercicio7.ts`, `await` coloca a leitura e o parse dentro do `try`; `catch (error: unknown)` verifica o tipo antes de acessar propriedades. O timer rejeita uma promise que é aguardada. `fetch` rejeita por falha de rede; uma resposta HTTP 404 chega normalmente e precisa de `response.ok`.

**Validação, na ordem observada com `npm run ex7`:**

```text
válido: {"modo":"teste"}
falha ao ler config: Error: ENOENT: no such file or directory, open '.../missing.json'
  code: 'ENOENT'
ausente: AppError: configuração não encontrada
falha ao ler config: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
JSON inválido: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
timer: Error: tentativa de releitura falhou
falha no fetch: TypeError: fetch failed
  [cause]: Error: getaddrinfo ENOTFOUND host-que-nao-existe.invalid
rede: TypeError: fetch failed
falha no fetch: AppError: HTTP 404
HTTP 404: AppError: HTTP 404
```

As linhas de stack e caminhos variam conforme o ambiente; `npm run ex7` imprime o objeto inteiro. A execução terminou com código 0, sem rejeição não tratada. `console.error` escreve em stderr e mantém o stack, o que ajuda a localizar a origem; `error.message` sozinho o perderia. Stacks assíncronos podem mostrar menos chamadas porque a execução passou por callbacks e eventos diferentes; `await`, stack completo e contexto no log ajudam a reconstruir a sequência.

## 8. ErrorHandler global

**Sintoma e reprodução.** O trecho inicial do enunciado depende de arquivos de um projeto anterior que não vieram nesta pasta. Naquele trecho, uma função com três parâmetros é middleware comum, então não recebe o erro como middleware de erro. No Express 4, uma rota `async` rejeitada sem `.catch(next)` pode ficar sem resposta. O resultado esperado para usuário inexistente é 404 em JSON, não 500 em texto nem timeout.

**Hipótese, ferramenta e causa:** pela assinatura e pela ordem dos middlewares, o erro não chegava ao handler; quando chegasse, o handler antigo fixaria status 500 e devolveria detalhes internos. Um middleware de erro do Express precisa de quatro parâmetros `(error, req, res, next)`, mesmo que algum não seja usado.

**Correção:** `src/server.ts` usa `ErrorRequestHandler`, `AppError.statusCode`, JSON com `statusCode`, `message` e `timestamp`, e um wrapper que envia rejeições assíncronas a `next`. O handler fica após as rotas, verifica `res.headersSent` e registra o stack em stderr. Se a resposta já começou, passa o erro adiante: tentar responder de novo causaria erro de cabeçalhos enviados. Erros inesperados mostram apenas mensagem genérica ao cliente. Um formato estável permite ao cliente tratar falhas sem analisar texto livre.

**Validação real com `npm test`:**

```text
/usuarios/1       200  {"id":"1","name":"Ana"}
/usuarios/99      404  {"statusCode":404,"message":"usuário não encontrado","timestamp":"2026-09-24T22:15:54.135Z"}
/usuarios/erro    500  {"statusCode":500,"message":"erro interno do servidor","timestamp":"2026-09-24T22:15:54.138Z"}
/rejeicao         500  mesmo formato, sem timeout
/sem-rota         404  mesmo formato
```

Os testes confirmaram os cinco status e os três campos de cada falha. O stack de `detalhe interno do banco` apareceu no log de erro, não no corpo da resposta. Os horários acima são da execução registrada e mudam a cada chamada.

## 9. Identificador de requisição

**Sintoma:** no trecho inicial, só a primeira linha tinha um contador. As linhas `buscando pedido` e `pedido encontrado` não tinham identificador; com três chamadas simultâneas, elas se misturariam. Um contador também reinicia em cada processo, então dois processos podem gerar o mesmo número.

**Correção e ferramenta:** `crypto.randomUUID()` gera o ID por requisição. Se o cliente enviar `x-request-id`, o middleware reaproveita seu valor e devolve o mesmo cabeçalho. `AsyncLocalStorage` mantém o ID após `await`, de modo que o serviço registra logs sem receber o ID como argumento em cada função. O custo é guardar um contexto pequeno e fazer uma leitura por linha de log; vale quando é preciso reconstruir chamadas concorrentes ou entre serviços. Em chamadas a outro serviço, deve-se enviar o mesmo cabeçalho para continuar o rastreio.

**Evidência real de três chamadas concorrentes em `npm test`, na ordem observada** (mostrados os campos `requestId` e `message` das linhas JSON):

```text
ff5d37d3-d208-45a8-8e5b-3064f2c29713  requisição recebida
ff5d37d3-d208-45a8-8e5b-3064f2c29713  buscando pedido
c3523386-b5d3-4bbe-bed8-8d5f3750a5ae  requisição recebida
c3523386-b5d3-4bbe-bed8-8d5f3750a5ae  buscando pedido
41968c02-50b0-4db8-a40a-0644e5961080  requisição recebida
41968c02-50b0-4db8-a40a-0644e5961080  buscando pedido
c3523386-b5d3-4bbe-bed8-8d5f3750a5ae  pedido encontrado
c3523386-b5d3-4bbe-bed8-8d5f3750a5ae  resposta enviada
41968c02-50b0-4db8-a40a-0644e5961080  pedido encontrado
41968c02-50b0-4db8-a40a-0644e5961080  resposta enviada
ff5d37d3-d208-45a8-8e5b-3064f2c29713  pedido encontrado
ff5d37d3-d208-45a8-8e5b-3064f2c29713  resposta enviada
```

**Mesmo log filtrado por `c3523386-b5d3-4bbe-bed8-8d5f3750a5ae`:**

```text
requisição recebida
buscando pedido
pedido encontrado
resposta enviada
```

O teste também verificou três IDs diferentes, a preservação de `id-do-cliente` no cabeçalho e o mesmo ID na linha de erro. UUIDs gerados em processos diferentes não dependem de um contador compartilhado; não havia PM2 instalado para executar um teste de dois processos nesta pasta.

## 10. Watch Expressions

**Sintoma e reprodução:** `npm run ex10` mostrou `antes: 320.63 332.5` para os mesmos itens nas ordens `[100, 150, 100]` e `[100, 100, 150]`. O total bruto é 350 e o esperado é 332,50 após um desconto de 5%.

**Hipótese e causa:** o desconto dentro do `for` reduz o total parcial e pode acontecer duas vezes. Para a primeira ordem, depois da segunda iteração o total já cai de 250 para 237,50; na terceira, cai de 337,50 para 320,625. A correção em `applyDiscount` soma tudo e só então aplica o desconto uma vez.

**Watch para reproduzir no VS Code:** execute a configuração `Exercício 10: Watch`; coloque breakpoint na linha `if (total > 200 && applied < 2)` de `brokenDiscount` em `src/exercicio10.ts`. Acrescente `total`, `applied`, `index`, `items[index].price * items[index].qty` e `items.slice(0, index + 1).reduce((sum, item) => sum + item.price * item.qty, 0)` ao painel Watch. A última expressão é a soma bruta dos itens percorridos. Use Step Over na condição e na subtração. Estes são os valores calculados em cada parada para a primeira ordem:

| `index` | `total` antes do `if` | `applied` | item atual | soma bruta | após Step Over da subtração |
|---:|---:|---:|---:|---:|---:|
| 0 | 100 | 0 | 100 | 100 | 100 |
| 1 | 250 | 0 | 150 | 250 | 237,50 |
| 2 | 337,50 | 1 | 100 | 350 | 320,625 |

O primeiro desvio acontece na iteração 1, depois da subtração. Um breakpoint condicional como `total > 200 && applied < 2` para apenas quando o desconto será aplicado. O painel de variáveis locais mostra automaticamente as variáveis do escopo; Watch avalia as expressões escolhidas. Uma expressão em Watch **pode alterar o estado** se chamar uma função com efeitos colaterais ou atribuir um valor, então use expressões de leitura. Um logpoint escreve uma mensagem ao passar pela linha sem pausar o programa; ajuda a investigar muitas iterações sem adicionar `console.log` ao código. Observar a transição expõe o momento do erro que o resultado final sozinho não mostra.

**Validação depois da correção:**

```text
antes: 320.63 332.5
depois: 332.5 332.5
180 -> 180; 200 -> 200; ordem original -> 332.5; ordem trocada -> 332.5; 500 -> 475; lista vazia -> 0
```

## 11. Memory leak

**Sintoma, hipótese e ferramenta:** o `Map` de cache, a lista de callbacks e os timers cresciam a cada requisição. O timer guarda o `id`; o callback da lista também. Mesmo sem executar o timer, o cache sozinho ainda segura os `Buffer`s. Usei `process.memoryUsage()` em MB a cada 200 requisições e `global.gc()` antes de medir, com `--expose-gc`, para comparar pontos após a coleta. Os `Buffer`s aparecem sobretudo em `external`, não em `heapUsed`; `rss` é a memória residente total, `heapTotal` é o espaço reservado para o heap V8, `heapUsed` é a parte ocupada dele e `external` inclui memória nativa associada a objetos JavaScript.

**Correção:** o cache corrigido guarda no máximo 50 entradas, remove a mais antiga e não cria timer nem listener permanente por requisição. Os timers da reprodução são cancelados ao terminar a medição. Para evitar reservar aproximadamente 1 GiB do exemplo original, cada `Buffer` de teste usa 64 KiB; as 2000 iterações e os pontos de medição foram mantidos.

**Medições reais, em MB, após coleta de lixo:**

| Requisições | Antes: `heapUsed` / `external` / `rss` | Sem timer: `heapUsed` / `external` / `rss` | Depois: `heapUsed` / `external` / `rss` |
|---:|---:|---:|---:|
| 0 | 3,47 / 1,15 / 34,47 | 3,47 / 1,15 / 34,45 | 3,47 / 1,15 / 35,19 |
| 200 | 3,93 / 13,93 / 48,23 | 3,87 / 13,93 / 48,02 | 3,81 / 13,93 / 47,98 |
| 400 | 4,05 / 26,43 / 60,89 | 3,94 / 26,43 / 60,66 | 3,82 / 17,06 / 49,10 |
| 600 | 4,18 / 38,93 / 73,61 | 4,01 / 38,93 / 73,32 | 3,82 / 17,06 / 51,75 |
| 800 | 4,28 / 51,43 / 86,39 | 4,08 / 51,43 / 86,11 | 3,83 / 17,06 / 51,07 |
| 1000 | 4,39 / 63,93 / 99,04 | 4,14 / 63,93 / 98,66 | 3,83 / 17,06 / 51,80 |
| 1200 | 4,54 / 76,43 / 111,80 | 4,23 / 76,43 / 111,25 | 3,83 / 17,06 / 51,44 |
| 1400 | 4,65 / 88,93 / 124,48 | 4,30 / 88,93 / 123,90 | 3,84 / 17,06 / 52,02 |
| 1600 | 4,75 / 101,43 / 137,20 | 4,36 / 101,43 / 136,67 | 3,84 / 17,06 / 51,93 |
| 1800 | 4,89 / 113,93 / 149,86 | 4,45 / 113,93 / 149,30 | 3,87 / 17,06 / 51,61 |
| 2000 | 5,00 / 126,43 / 162,64 | 4,52 / 126,43 / 161,87 | 3,87 / 17,06 / 52,05 |

Sem timer, `timers` ficou em 0, mas `cache` e `listeners` chegaram a 2000; o consumo continuou a subir. Depois da correção, `cache` ficou em 50 e `listeners`/`timers` em 0. Com `node --max-old-space-size=5 --expose-gc dist/exercicio11.js antes`, o último ponto impresso foi 1200 e em seguida apareceu `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` (código 1). O mesmo comando com `depois` chegou a 2000 (código 0). Esse limite reduzido é só uma ferramenta de reprodução, não a correção.

Uma medida única não prova vazamento: uso alto pode ser normal se a aplicação precisa daquela memória. Vazamento é retenção crescente sem limite após a carga se repetir e após a coleta. Timers e coleções de callbacks são causas comuns porque mantêm referências fortes. Dois heap snapshots mostrariam **quais objetos aumentaram e quem os retém**, além da curva numérica; a captura com `--inspect` ficou como desafio opcional e não foi executada. `WeakMap` pode ajudar quando a chave é um objeto cuja vida não deve ser prolongada pelo cache; aqui as chaves são strings, então o limite explícito é a solução apropriada.
