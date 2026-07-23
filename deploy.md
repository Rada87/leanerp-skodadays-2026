# Nasazení

Projekt je statický a nemá build krok. GitHub slouží pro verzování celého projektu; na VPS se rsyncem posílají jen adresáře ze `src/`.

## Veřejná adresa

Po nasazení bude projekt dostupný na:

<https://srv1848295.hstgr.cloud/www/leanerp-skodadays-2026/>

## Cílová struktura na VPS

```text
/srv/www/leanerp-skodadays-2026/
├── public/           # obsah z lokálního src/public/
├── app/              # obsah z lokálního src/app/
└── data/             # případné soubory mimo Git, ze src/data/
```

Nginx pro tento projekt obsluhuje cestu `/www/leanerp-skodadays-2026/` výhradně z adresáře `public/`.

## Online leaderboard

Třetí slide načítá živé výsledky z quizu přes stejnou HTTPS doménu:

```text
https://srv1848295.hstgr.cloud/apps/leanerp-sd-quiz/api/leaderboard
```

Každých 30 sekund se data obnoví; při vstupu na třetí slide proběhne nové načtení ihned. Pokud zatím neexistuje výsledek, slide zobrazí stav `No quiz results yet.`

## Aktuální serverová konfigurace

Projekt je nasazený na <https://srv1848295.hstgr.cloud/www/leanerp-skodadays-2026/>.

- Nginx konfigurace je v `/etc/nginx/sites-available/leanerp-skodadays-2026`.
- HTTPS certifikát pro `srv1848295.hstgr.cloud` spravuje Certbot/Let's Encrypt; automatické obnovení zajišťuje `certbot.timer`.
- Po změně Nginx konfigurace vždy spusťte `sudo nginx -t` a teprve potom `sudo systemctl reload nginx`.

## První nasazení na serveru

Přihlaste se jako administrátor a vytvořte cílové adresáře:

```sh
sudo install -d -o rada -g rada /srv/www/leanerp-skodadays-2026/public
sudo install -d -o rada -g rada /srv/www/leanerp-skodadays-2026/app
sudo install -d -o rada -g rada /srv/www/leanerp-skodadays-2026/data
```

Poté se přidá a otestuje odpovídající Nginx `location` blok.

## Aktualizace kódu

Z kořene lokálního projektu:

```sh
rsync -av --delete --exclude='.gitignore' src/public/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/public/
rsync -av --delete src/app/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/app/
```

`--delete` je bezpečný jen pro versionovaný kód. Pro statický web není nutný restart služby.

Veřejná média ve `src/public/media/` (například obrázky a MP4) jsou záměrně ignorovaná Gitem, ale tento rsync je nasadí na server. Před deployem proto musí být v lokálním adresáři dostupná.

## Ověření po nasazení

Každé nasazení musí skončit kontrolou veřejné adresy a HTTP statusu `200`:

```sh
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
  https://srv1848295.hstgr.cloud/www/leanerp-skodadays-2026/

curl --fail --silent --show-error \
  https://srv1848295.hstgr.cloud/apps/leanerp-sd-quiz/api/leaderboard
```

Pokud příkaz nevrátí `200`, nasazení není dokončené; nejdřív je potřeba ověřit Nginx konfiguraci, cílové soubory a logy.

Skryté soubory v public rootu (například `.env` a `.gitignore`) musí Nginx vracet jako `404`.

## Neversionovaná data

Pokud projekt později získá fotografie, PDF nebo SQLite databázi, patří do `/srv/www/leanerp-skodadays-2026/data/`, nikoli do repozitáře. Lokálně je protějškem adresář `src/data/`. Soubory se synchronizují samostatně, například:

```sh
rsync -av src/data/assets/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/data/assets/
```

Bez výslovného rozhodnutí nepoužívejte `--delete`, aby nasazení nesmazalo existující data.
