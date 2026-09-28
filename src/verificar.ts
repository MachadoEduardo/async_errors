import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddressInfo } from 'node:net';
import { app } from './server';
import { applyDiscount } from './exercicio10';

test('exercício 8: respostas e erros padronizados', async () => {
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    for (const [path, status] of [
      ['/usuarios/1', 200],
      ['/usuarios/99', 404],
      ['/usuarios/erro', 500],
      ['/rejeicao', 500],
      ['/sem-rota', 404]
    ] as const) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, status);
      assert.ok(response.headers.get('x-request-id'));
      if (status !== 200) {
        assert.deepEqual(Object.keys(body).sort(), ['message', 'statusCode', 'timestamp']);
        assert.equal(body.statusCode, status);
        assert.ok(!JSON.stringify(body).includes('detalhe interno'));
        assert.ok(!JSON.stringify(body).includes('stack'));
        if (path === '/usuarios/99' || path === '/usuarios/erro') {
          console.log('resposta observada:', path, response.status, JSON.stringify(body));
        }
      }
    }
  } finally {
    server.close();
  }
});

test('exercício 9: três requisições concorrentes e id enviado pelo cliente', async () => {
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const responses = await Promise.all(['1', '2', '3'].map((id) =>
      fetch(`http://127.0.0.1:${port}/pedidos/${id}`)));
    const ids = responses.map((response) => response.headers.get('x-request-id'));
    assert.equal(new Set(ids).size, 3);
    for (const response of responses) assert.equal(response.status, 200);
    const supplied = await fetch(`http://127.0.0.1:${port}/usuarios/99`, {
      headers: { 'x-request-id': 'id-do-cliente' }
    });
    assert.equal(supplied.headers.get('x-request-id'), 'id-do-cliente');
  } finally {
    server.close();
  }
});

test('exercício 10: desconto único, independente da ordem', () => {
  const items = [{ price: 100, qty: 1 }, { price: 150, qty: 1 }, { price: 50, qty: 2 }];
  assert.equal(applyDiscount(items), 332.5);
  assert.equal(applyDiscount([items[0], items[2], items[1]]), 332.5);
  assert.equal(applyDiscount([{ price: 180, qty: 1 }]), 180);
  assert.equal(applyDiscount([{ price: 200, qty: 1 }]), 200);
  assert.equal(applyDiscount([{ price: 500, qty: 1 }]), 475);
  assert.equal(applyDiscount([]), 0);
});
