# NZ Road Trip 2027

App da viagem de motorhome pela Nova Zelândia (9–26 fev 2027): roteiro dia a dia, mapa ponto a ponto offline, reservas, listas, anotações e anexos (ingressos e comprovantes).

- **Tipo:** PWA (instala na tela inicial do iPhone/Android, abre em tela cheia, funciona sem internet).
- **Backend:** Supabase (projeto `NZ Road Trip 2027`): tabela `trip_docs` com tempo real, bucket privado `anexos`, função `register` para o primeiro acesso.
- **Acesso:** só e-mails na tabela `allowed_emails`.
- **Sem build:** arquivos estáticos. Publicado no Vercel a partir deste repositório.

Para liberar outro e-mail:
```sql
insert into public.allowed_emails(email) values ('novo@email.com');
```
