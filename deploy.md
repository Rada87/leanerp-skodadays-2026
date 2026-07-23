# Nasazení

Projekt je statický a nemá build krok. GitHub slouží pro verzování celého projektu; na VPS se rsyncem posílají jen adresáře ze `src/`.

## Cílová struktura na VPS

```text
/srv/www/leanerp-skodadays-2026/
├── public/           # obsah z lokálního src/public/
├── app/              # obsah z lokálního src/app/
└── data/             # případné soubory mimo Git, ze src/data/
```

Nginx pro tento projekt obsluhuje cestu `/www/leanerp-skodadays-2026/` výhradně z adresáře `public/`.

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
rsync -av --delete src/public/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/public/
rsync -av --delete src/app/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/app/
```

`--delete` je bezpečný jen pro versionovaný kód. Pro statický web není nutný restart služby.

## Neversionovaná data

Pokud projekt později získá fotografie, PDF nebo SQLite databázi, patří do `/srv/www/leanerp-skodadays-2026/data/`, nikoli do repozitáře. Lokálně je protějškem adresář `src/data/`. Soubory se synchronizují samostatně, například:

```sh
rsync -av src/data/assets/ rada@srv1848295.hstgr.cloud:/srv/www/leanerp-skodadays-2026/data/assets/
```

Bez výslovného rozhodnutí nepoužívejte `--delete`, aby nasazení nesmazalo existující data.
