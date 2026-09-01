# EliteFlow 2.6 — Loja, retenção e planos anuais

## Exclusão de barbearias pelo Supermaster
- Exclusão recuperável exige o nome exato da barbearia + o código TOTP atual do Supermaster.
- A barbearia fica bloqueada e recuperável por 30 dias.
- Após o prazo, uma rotina automática elimina permanentemente os dados do tenant.
- O Supermaster também pode escolher exclusão permanente imediata, igualmente protegida por nome exato + TOTP.
- Códigos 2FA não são armazenados em logs de auditoria.

## Loja pública
- Recurso disponível para Pro e Premium.
- Configuração em Barbearia → Loja.
- Banner e logo opcionais.
- A vitrine usa os mesmos produtos e estoque de Gestão → Produtos.
- O dono/gerente escolhe quais produtos aparecem na loja e quais ficam em destaque na página pública.
- A primeira versão da loja usa “Pedir no WhatsApp”; não há checkout de e-commerce de produtos nesta etapa.

## Planos (histórico da versão 2.6)
Os valores abaixo pertenciam à versão 2.6. Consulte o README para os preços comerciais atuais.
- Starter: R$ 59,90/mês ou R$ 599/ano.
- Pro: R$ 109,90/mês ou R$ 1.099/ano.
- Premium: R$ 189,90/mês ou R$ 1.899/ano.
- O anual equivalia aproximadamente a 10 mensalidades.
- Cartão anual usa recorrência anual; Pix anual é pré-pago por 12 meses.
