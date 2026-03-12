# FinAgent v2 — Gestor de Finanzas Personales en AWS

Aplicación web multi-contenedor para gestión de finanzas personales desplegada en AWS con alta disponibilidad. Permite registrar ingresos y gastos con categorías personalizadas, visualizar dashboards con resúmenes mensuales y consultar históricos.

---

## Tabla de Contenidos

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [API Endpoints](#api-endpoints)
6. [Proceso de Desarrollo — Paso a Paso](#proceso-de-desarrollo--paso-a-paso)
7. [Errores Encontrados y Soluciones](#errores-encontrados-y-soluciones)
8. [Despliegue Local con Docker Compose](#despliegue-local-con-docker-compose)
9. [Despliegue en AWS — Paso a Paso](#despliegue-en-aws--paso-a-paso)
10. [Docker Hub](#docker-hub)
11. [Pruebas de Alta Disponibilidad](#pruebas-de-alta-disponibilidad)
12. [Aprendizajes y Conclusiones](#aprendizajes-y-conclusiones)
13. [Autor](#autor)

---

## Descripción del Proyecto

FinAgent v2 es una evolución del proyecto original FinAgent, que utilizaba la API de Google Gemini para leer facturas. En esta versión se reemplazó Gemini por un **clasificador de IA propio** basado en scikit-learn (TF-IDF + Naive Bayes) que clasifica automáticamente las transacciones en categorías usando procesamiento de lenguaje natural (NLP). El usuario digita sus gastos e ingresos, y la IA sugiere la categoría en tiempo real. El modelo se re-entrena dinámicamente con cada transacción y categoría nueva.

### ¿Qué cambió respecto a v1?

| Aspecto | v1 (Original) | v2 (Actual) |
|---------|---------------|-------------|
| Entrada de datos | Subir foto de factura → Gemini la lee | Formulario manual + IA sugiere categoría |
| IA | Google Gemini API (externa) | scikit-learn TF-IDF + Naive Bayes (local) |
| Categorías | Fijas | Dinámicas (CRUD desde la app) |
| Tipo de movimiento | Solo gastos | Gastos e ingresos (balance) |
| Frontend | HTML estático (subir imagen) | React SPA con dashboard, historial, categorías |
| Dependencias externas | Google Gemini API, httpx | scikit-learn (corre localmente) |
| Backend | FastAPI + Gemini | FastAPI + scikit-learn |

### Decisiones de diseño

- **IA local con scikit-learn**: se eligió un modelo TF-IDF + Naive Bayes que corre dentro del contenedor, sin necesidad de API keys externas ni conexión a servicios de terceros.
- **IA dinámica**: el modelo lee las categorías de la BD al arrancar y se re-entrena automáticamente al crear categorías o transacciones nuevas. Categorías nuevas del usuario se incorporan al modelo sin reiniciar.
- **Categorías dinámicas**: el usuario puede crear, editar y eliminar categorías desde la app, en lugar de tener categorías fijas.
- **React para el frontend**: se eligió React por mejor UX y dinamismo frente al HTML estático original.
- **Gastos e ingresos**: se maneja balance completo, no solo gastos.
- **BD compartida**: solo una instancia tiene PostgreSQL; la otra se conecta por IP privada.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite | React 18, Vite 5 |
| Gráficos | Recharts | 2.x |
| Fechas | date-fns | 3.x |
| Backend | FastAPI + Uvicorn | FastAPI 0.104, Python 3.11 |
| IA/NLP | scikit-learn (TF-IDF + Naive Bayes) | 1.5.0 |
| ORM | SQLAlchemy | 2.x |
| Validación | Pydantic | 2.x |
| Base de datos | PostgreSQL | 15 (Alpine) |
| Contenedores | Docker + Docker Compose | Latest |
| Proxy reverso | Nginx | Alpine |
| Infraestructura | AWS (VPC, EC2, ALB) | us-east-1 |

---

## Arquitectura

### Arquitectura de Contenedores (por instancia)

```
┌─────────────────────────────────────────────┐
│                  EC2 Instance                │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Frontend │  │ Backend  │  │ PostgreSQL│ │
│  │ (Nginx)  │──│ (FastAPI)│──│   (DB)    │ │
│  │  :80     │  │  :8000   │  │  :5432    │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│       Docker Compose (appuser)              │
└─────────────────────────────────────────────┘
```

### Arquitectura AWS (Alta Disponibilidad)

```
                    Internet
                       │
              ┌────────┴────────┐
              │   Application   │
              │  Load Balancer  │
              │  (alb-finagent) │
              │ Subnets Públicas│
              └────────┬────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────┴────────┐       ┌─────────┴────────┐
│ Subnet Privada  │       │  Subnet Privada  │
│   us-east-1a    │       │   us-east-1b     │
│                 │       │                  │
│ ┌─────────────┐ │       │ ┌──────────────┐ │
│ │finagent-ec2 │ │       │ │finagent-ec2  │ │
│ │   -az-a     │ │       │ │   -az-b      │ │
│ │  t2.micro   │ │       │ │  t2.micro    │ │
│ │             │ │       │ │              │ │
│ │ Frontend    │ │  5432  │ │ Frontend     │ │
│ │ Backend     │◄├───────┤►│ Backend      │ │
│ │ PostgreSQL  │ │  (IP   │ │ (sin BD)     │ │
│ │ (BD única)  │ │privada)│ │              │ │
│ └─────────────┘ │       │ └──────────────┘ │
└─────────────────┘       └──────────────────┘

VPC: 10.0.0.0/16 (finagent-vpc)
NAT Gateway: permite salida a internet desde subnets privadas
```

### Flujo de Red

1. El usuario accede por el DNS del ALB
2. El ALB distribuye tráfico HTTP (puerto 80) entre las 2 instancias EC2
3. Nginx recibe la petición en el puerto 80
4. Si es una ruta `/api/*`, Nginx hace proxy_pass al backend en el puerto 8000
5. Si es cualquier otra ruta, Nginx sirve la app React (archivos estáticos)
6. El backend consulta PostgreSQL en el puerto 5432

---

## Estructura del Proyecto

```
finagent/
├── backend/
│   ├── main.py              # API REST + endpoints IA
│   ├── ai_classifier.py     # Clasificador NLP dinámico (scikit-learn)
│   ├── models.py            # Modelos SQLAlchemy (Category, Transaction)
│   ├── schemas.py           # Schemas Pydantic (validación entrada/salida)
│   ├── database.py          # Configuración conexión PostgreSQL
│   ├── requirements.txt     # Dependencias Python (incluye scikit-learn)
│   └── Dockerfile           # Imagen backend (python:3.11-slim)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Layout principal con sidebar y navegación
│   │   ├── main.jsx         # Entry point React
│   │   ├── lib/
│   │   │   ├── api.js       # Cliente HTTP centralizado (incluye IA)
│   │   │   └── utils.js     # Formateo COP, fechas, colores
│   │   ├── components/
│   │   │   ├── Modal.jsx    # Modal reutilizable
│   │   │   └── TransactionForm.jsx  # Formulario con sugerencia IA
│   │   └── pages/
│   │       ├── Dashboard.jsx   # KPIs + gráfico dona + barras históricas
│   │       ├── Historial.jsx   # Tabla filtrable con editar/eliminar
│   │       └── Categorias.jsx  # CRUD categorías con ícono y color
│   ├── package.json         # Dependencias Node
│   ├── vite.config.js       # Config Vite con proxy al backend
│   ├── index.html           # Entry point HTML
│   └── Dockerfile           # Multi-stage: Node build → Nginx serve
├── nginx/
│   └── nginx.conf           # Proxy reverso: / → React, /api → FastAPI
├── docker-compose.yml       # Orquestación completa (frontend + backend + db)
├── docker-compose.nodb.yml  # Para instancias sin BD (frontend + backend)
├── .env.example             # Variables de entorno template
└── README.md
```

---

## API Endpoints

### Categorías

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/categories` | Listar todas las categorías |
| POST | `/api/categories` | Crear nueva categoría (name, icon, color) |
| PUT | `/api/categories/{id}` | Actualizar categoría |
| DELETE | `/api/categories/{id}` | Eliminar categoría |

### Transacciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/transactions` | Listar transacciones (filtros: month, category, type) |
| POST | `/api/transactions` | Crear transacción (description, total, type, category_id, date, payment_method, notes) |
| PUT | `/api/transactions/{id}` | Actualizar transacción |
| DELETE | `/api/transactions/{id}` | Eliminar transacción |

### Estadísticas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/stats?month=YYYY-MM` | Resumen del mes: total gastos, ingresos, balance, conteo, gastos por categoría, histórico 6 meses |

### IA (Inteligencia Artificial)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/ai/classify` | Clasificar descripción → devuelve categoría predicha, confianza, top 3 |
| POST | `/api/ai/retrain` | Re-entrenar modelo manualmente con datos actuales |
| GET | `/api/ai/info` | Información del modelo: tipo, categorías, features |

**Ejemplo de uso:**
```json
// POST /api/ai/classify
// Request:
{"description": "Uber al trabajo"}

// Response:
{
  "category": "Transporte",
  "confidence": 98.2,
  "all_predictions": [
    {"category": "Transporte", "confidence": 98.2},
    {"category": "Freelance", "confidence": 0.9},
    {"category": "Hogar", "confidence": 0.1}
  ]
}
```

---

## Proceso de Desarrollo — Paso a Paso

### Fase 1 — Análisis del proyecto original

Se analizó el código base de FinAgent v1 que incluía:
- Backend con FastAPI + integración con Google Gemini para análisis de facturas
- Frontend HTML estático para subir imágenes de facturas
- Docker Compose con 3 servicios (frontend, backend, db)
- PostgreSQL como base de datos

Se decidió reutilizar la estructura base (FastAPI + PostgreSQL + Docker Compose) y eliminar todo lo relacionado con Gemini.

### Fase 2 — Modificación del Backend

**Archivos modificados:**

1. **models.py**: Se creó el modelo `Category` (nombre, ícono, color). Se actualizó `Transaction` reemplazando `store` por `description`, agregando `type` (gasto/ingreso) y `notes`.

2. **schemas.py**: Se crearon schemas para Category (CategoryCreate, CategoryUpdate, CategoryOut). Se actualizaron los schemas de Transaction para reflejar los nuevos campos.

3. **main.py**: Se eliminaron todos los endpoints y lógica de Gemini (`/api/analyze`). Se implementó CRUD completo de categorías. Se actualizó el endpoint `/api/stats` para retornar gastos, ingresos y balance.

4. **requirements.txt**: Se eliminó `httpx` (ya no se necesita para llamar a Gemini).

5. **docker-compose.yml**: Se eliminó la variable `GEMINI_API_KEY`.

6. **.env.example**: Se eliminó `GEMINI_API_KEY`.

### Fase 3 — Creación del Frontend React

Se reemplazó el `index.html` estático por una SPA completa en React:

- **App.jsx**: Layout con sidebar de navegación (Dashboard, Historial, Categorías) y botón flotante "Nueva transacción"
- **Dashboard.jsx**: 4 tarjetas KPI (ingresos, gastos, balance, movimientos), gráfico de dona por categoría, gráfico de barras histórico 6 meses
- **Historial.jsx**: Tabla con todas las transacciones, filtros por mes/categoría/tipo, acciones editar/eliminar
- **Categorias.jsx**: CRUD de categorías con selector de ícono emoji y color
- **TransactionForm.jsx**: Formulario modal para crear/editar transacciones
- **api.js**: Cliente HTTP centralizado con manejo de errores
- **utils.js**: Funciones de formateo (moneda COP, fechas, etc.)

**Frontend Dockerfile**: Se implementó un build multi-stage:
1. Stage 1 (Node): `npm install` + `npm run build` → genera archivos estáticos
2. Stage 2 (Nginx): Copia los archivos del build al servidor Nginx

### Fase 4 — Pruebas Locales

Se probó todo el sistema localmente con `docker compose up --build`. Se encontraron y corrigieron varios bugs (ver sección de Errores).

### Fase 5 — Implementación de IA (Clasificador NLP)

Se agregó inteligencia artificial al proyecto para cumplir con el requisito de "aplicación de IA":

1. **ai_classifier.py**: Módulo de clasificación usando scikit-learn.
   - Pipeline: TF-IDF (char_wb, ngrams 2-4) + Multinomial Naive Bayes
   - Datos base: ~160 ejemplos en español para 15 categorías comunes
   - Dinámico: lee categorías de la BD al arrancar, se re-entrena al crear categorías/transacciones
   - Para categorías nuevas sin keywords, genera variantes automáticas ("pago X", "gasto X", "compra X")

2. **main.py**: Nuevos endpoints `/api/ai/classify`, `/api/ai/retrain`, `/api/ai/info`. El modelo se re-entrena automáticamente al crear categorías o transacciones.

3. **TransactionForm.jsx**: Cuando el usuario escribe la descripción de un gasto, después de 500ms se llama a la IA. Muestra un badge 🤖 con las 3 categorías sugeridas y su porcentaje de confianza. Si la confianza es >50%, auto-selecciona la categoría.

4. **api.js**: Se agregó el método `classifyDescription()` al cliente HTTP.

5. **requirements.txt**: Se agregó `scikit-learn==1.5.0`.

### Fase 6 — Subida a GitHub

```bash
git init
git add .
git commit -m "feat: finagent v2 - gestor de finanzas multi-container"
git branch -M main
git remote add origin https://github.com/nicolasvasquezr/FinAgent_V2_AWS_CELN.git
git push -u origin main
```

### Fase 6 — Despliegue en AWS

Proceso completo documentado en la sección [Despliegue en AWS](#despliegue-en-aws--paso-a-paso).

---

## Errores Encontrados y Soluciones

### Error 1: Categorías no aparecían para Ingresos

**Problema**: En `TransactionForm.jsx`, las categorías de ingreso estaban filtradas con un array fijo `['Salario','Freelance','Otro']`. Si el usuario creaba categorías nuevas para ingresos, no aparecían.

**Solución**: Se cambió para mostrar todas las categorías disponibles tanto para gastos como para ingresos, ya que las categorías son dinámicas y el usuario define qué es qué.

### Error 2: Internal Server Error al guardar gastos (500)

**Problema**: El schema `TransactionOut` en `schemas.py` definía `notes: str` (obligatorio), pero cuando la base de datos devolvía `None` en ese campo, Pydantic lanzaba un error de validación al serializar la respuesta.

**Solución**: Se cambió a `notes: Optional[str] = ""` en el schema. También se aseguró que el formulario frontend siempre envíe `notes` como string vacío y nunca como `null`.

### Error 3: Tabla con esquema viejo en PostgreSQL

**Problema**: Al cambiar el modelo (renombrar `store` → `description`, agregar `type`, `notes`), la tabla en PostgreSQL mantenía el esquema viejo porque el volumen de Docker conservaba la BD original.

**Error en logs**: `LINE 1: SELECT transactions.id AS transactions_id, transactions.desc... ^`

**Solución**: Borrar el volumen y recrear la BD desde cero:
```bash
docker compose down -v
docker compose up --build
```

### Error 4: Dashboard no se actualizaba al agregar transacciones

**Problema**: En `App.jsx`, el `<div key={refreshKey}>` envolvía todo el árbol de componentes. Cada vez que se agregaba una transacción, el Dashboard se desmontaba y remontaba completo antes de que la BD confirmara el dato, causando una condición de carrera.

**Solución**: Se eliminó el `key={refreshKey}` del div contenedor. En su lugar, se pasa `refreshKey` como prop al Dashboard, que lo usa en el array de dependencias del `useEffect` para re-consultar la API sin desmontarse.

### Error 5: KeyError 'ingreso' en endpoint /api/stats

**Problema**: En `main.py`, el diccionario mensual del histórico se inicializaba con `{"gastos": 0, "ingresos": 0}` (plural), pero el código hacía `key = t.type` que devuelve `"ingreso"` o `"gasto"` (singular). La clave no coincidía → `KeyError`.

**Error en logs**: `KeyError: 'ingreso'`

**Solución**: Se cambió la inicialización del diccionario para usar las claves en singular (`"gasto"` y `"ingreso"`) que coinciden con los valores del campo `type` en la BD, y se mapean a las claves del response al final.

### Error 6: Git push fallaba con "src refspec main does not match any"

**Problema**: Git creó la rama como `master` por defecto, pero el push se intentaba a `main`.

**Solución**:
```bash
git branch -M main
git push -u origin main
```

### Error 7: Git remote con URL inválida (error 400)

**Problema**: La URL del remote tenía `< >` literales: `https://github.com/<nicolasvasquezr>/<FinAgent_V2_AWS_CELN>.git`

**Solución**:
```bash
git remote set-url origin https://github.com/nicolasvasquezr/FinAgent_V2_AWS_CELN.git
```

### Error 8: No se podía conectar a instancias EC2 en subredes privadas

**Problema**: Las instancias se desplegaron inicialmente en subredes privadas (sin IP pública). Se intentó usar EC2 Instance Connect Endpoint y SSM Session Manager, pero ninguno funcionó:
- EC2 Instance Connect Endpoint: fallaba con "Failed to connect to your instance"
- SSM Session Manager: requería IAM role que no estaba configurado en el Learner Lab

**Solución**: Se terminaron las instancias y se relanzaron en **subredes públicas** con IP pública habilitada. Esto permitió conexión directa por EC2 Instance Connect con IP pública.

### Error 9: Docker Compose build fallaba — "requires buildx 0.17.0 or later"

**Problema**: La versión de Docker instalada por `yum` en Amazon Linux 2023 no incluía buildx actualizado.

**Error**: `compose build requires buildx 0.17.0 or later`

**Solución**: Instalar buildx manualmente:
```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
sudo systemctl restart docker
```

### Error 10: buildx descargado con arquitectura incorrecta — "exec format error"

**Problema**: El primer intento de descargar buildx usó la URL genérica `latest/download/` que descargó un binario con nombre incorrecto.

**Error**: `fork/exec /usr/local/lib/docker/cli-plugins/docker-buildx: exec format error`

**Solución**: Usar la URL específica de la release con la versión exacta:
```bash
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
```

### Error 11: App no cargaba por IP pública en el navegador

**Problema**: El Security Group de las EC2 (`2sg-ec2-finagent`) solo permitía HTTP desde el ALB, no desde internet directamente.

**Solución**: Se agregó una regla inbound temporal: HTTP (80) desde `0.0.0.0/0` para poder probar la app directamente por IP pública antes de configurar el ALB.

---

## Despliegue Local con Docker Compose

### Requisitos
- Docker y Docker Compose instalados

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/nicolasvasquezr/FinAgent_V2_AWS_CELN.git
cd FinAgent_V2_AWS_CELN

# 2. Crear archivo de entorno
cp .env.example .env

# 3. Levantar contenedores
docker compose up --build

# 4. Acceder a la app
# Frontend: http://localhost
# API Docs (Swagger): http://localhost:8000/docs
```

### Contenedores

| Contenedor | Imagen | Puerto | Descripción |
|-----------|--------|--------|-------------|
| finagent_frontend | finagent-frontend | 80 | React + Nginx |
| finagent_backend | finagent-backend | 8000 | FastAPI + Uvicorn |
| finagent_db | postgres:15-alpine | 5432 | PostgreSQL |

### Para reiniciar desde cero (borra todos los datos)

```bash
docker compose down -v
docker compose up --build
```

---

## Despliegue en AWS — Paso a Paso

### Paso 1 — Acceder a AWS Academy Learner Lab

1. Abrir el enlace de invitación del profesor a AWS Academy
2. Navegar al módulo **Learner Lab**
3. Clic en **Start Lab** → esperar que el círculo se ponga verde (~2 minutos)
4. Clic en **AWS** para abrir la consola de AWS
5. Verificar que la región sea **us-east-1 (N. Virginia)**

> **Nota**: El Learner Lab se apaga automáticamente después de ~4 horas. Guardar progreso conforme se avanza.

### Paso 2 — Crear VPC

1. AWS Console → buscar **VPC** → clic en VPC
2. Clic en **Create VPC** → seleccionar **VPC and more**
3. Configuración:

| Campo | Valor |
|-------|-------|
| Name tag | finagent |
| IPv4 CIDR | 10.0.0.0/16 |
| Number of AZs | 2 |
| Public subnets | 2 |
| Private subnets | 2 |
| NAT gateways | In 1 AZ |
| VPC endpoints | None |

4. Clic en **Create VPC** → esperar ~2 minutos (crea NAT Gateway)

Esto crea automáticamente: VPC, 4 subredes (2 públicas + 2 privadas), Internet Gateway, NAT Gateway, y Route Tables.

### Paso 3 — Crear Security Groups

En VPC → Security Groups → Create security group. Se crearon 3:

**1sg-alb-finagent** (Load Balancer — acceso público):

| Type | Port | Source |
|------|------|--------|
| HTTP | 80 | 0.0.0.0/0 |

**2sg-ec2-finagent** (Instancias EC2 — acceso desde ALB y SSH):

| Type | Port | Source |
|------|------|--------|
| HTTP | 80 | sg-alb-finagent (seleccionar del dropdown) |
| SSH | 22 | 0.0.0.0/0 |
| HTTP | 80 | 0.0.0.0/0 (agregado después para pruebas directas) |

**3sg-db-finagent** (Base de datos — acceso solo desde EC2):

| Type | Port | Source |
|------|------|--------|
| Custom TCP | 5432 | sg-ec2-finagent (seleccionar del dropdown) |

### Paso 4 — Lanzar instancias EC2

Se lanzaron 2 instancias t2.micro con Amazon Linux 2023 en **subredes privadas**.

> **Lección aprendida**: Inicialmente se intentó en subredes públicas para facilitar el debugging. Después se migraron a subredes privadas como exige la consigna. La conexión SSH se hace mediante un bastion host temporal en subnet pública.

**finagent-ec2-az-a** (lleva la base de datos):

| Campo | Valor |
|-------|-------|
| Name | finagent-ec2-az-a |
| AMI | Amazon Linux 2023 |
| Instance type | t2.micro |
| Key pair | Proceed without a key pair |
| VPC | finagent-vpc |
| Subnet | finagent-subnet-private1-us-east-1a |
| Auto-assign public IP | Disable |
| Security group | 2sg-ec2-finagent |

**User Data AZ-a** (levanta frontend + backend + PostgreSQL):

```bash
#!/bin/bash
yum update -y
yum install -y docker git
systemctl enable docker
systemctl start docker
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
useradd -m -s /bin/bash appuser
usermod -aG docker appuser
su - appuser -c "git clone https://github.com/nicolasvasquezr/FinAgent_V2_AWS_CELN.git /home/appuser/finagent"
cat > /home/appuser/finagent/.env << 'EOF'
POSTGRES_DB=finagent
POSTGRES_USER=finagent
POSTGRES_PASSWORD=finagent2024
EOF
chown appuser:appuser /home/appuser/finagent/.env
su - appuser -c "cd /home/appuser/finagent && docker-compose up -d"
```

**finagent-ec2-az-b** (sin BD, se conecta a AZ-a por IP privada):

| Campo | Valor |
|-------|-------|
| Name | finagent-ec2-az-b |
| AMI | Amazon Linux 2023 |
| Instance type | t2.micro |
| Key pair | Proceed without a key pair |
| VPC | finagent-vpc |
| Subnet | finagent-subnet-private2-us-east-1b |
| Auto-assign public IP | Disable |
| Security group | 2sg-ec2-finagent |

**User Data AZ-b** (usa `docker-compose.nodb.yml`, apunta a la BD de AZ-a):

```bash
#!/bin/bash
yum update -y
yum install -y docker git
systemctl enable docker
systemctl start docker
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
useradd -m -s /bin/bash appuser
usermod -aG docker appuser
su - appuser -c "git clone https://github.com/nicolasvasquezr/FinAgent_V2_AWS_CELN.git /home/appuser/finagent"
cat > /home/appuser/finagent/.env << 'EOF'
POSTGRES_DB=finagent
POSTGRES_USER=finagent
POSTGRES_PASSWORD=finagent2024
DATABASE_URL=postgresql://finagent:finagent2024@10.0.132.57:5432/finagent
EOF
chown appuser:appuser /home/appuser/finagent/.env
su - appuser -c "cd /home/appuser/finagent && docker-compose -f docker-compose.nodb.yml up -d"
```

> **Nota**: `10.0.132.57` es la IP privada de AZ-a. AZ-b usa `docker-compose.nodb.yml` que solo levanta frontend y backend (sin PostgreSQL), y el backend se conecta a la BD de AZ-a por la red privada de la VPC.

### Paso 5 — Verificar que la app corre en las instancias

Como las instancias están en subredes privadas, no se puede conectar directamente. Se usó un **bastion host temporal** (instancia en subnet pública) para verificar:

```bash
# Desde el bastion host:
curl -s http://10.0.132.57/api/categories | head -50    # AZ-a
curl -s http://10.0.149.32/api/categories | head -50    # AZ-b
```

Ambas instancias devolvieron las mismas categorías con el mismo `created_at`, confirmando que AZ-b se conecta correctamente a la BD de AZ-a.

### Paso 6 — Crear Target Group

1. EC2 → Target Groups → Create target group
2. Configuración:

| Campo | Valor |
|-------|-------|
| Target type | Instances |
| Name | tg-finagent |
| Protocol | HTTP |
| Port | 80 |
| VPC | finagent-vpc |
| Health check path | / |

3. Clic en **Next**
4. Seleccionar **ambas instancias** (az-a y az-b) → clic en **Include as pending below**
5. Clic en **Create target group**

### Paso 7 — Crear Application Load Balancer

1. EC2 → Load Balancers → Create Load Balancer → Application Load Balancer
2. Configuración:

| Campo | Valor |
|-------|-------|
| Name | alb-finagent |
| Scheme | Internet-facing |
| IP address type | IPv4 |
| VPC | finagent-vpc |
| AZs | us-east-1a (subnet pública) + us-east-1b (subnet pública) |
| Security group | 1sg-alb-finagent |
| Listener | HTTP:80 → Forward to tg-finagent |

3. Clic en **Create load balancer**
4. Esperar ~2-3 minutos hasta que el estado pase de **Provisioning** a **Active**

### Paso 8 — Acceder a la aplicación

Copiar el **DNS name** del ALB y abrirlo en el navegador:

`http://alb-finagent-935698949.us-east-1.elb.amazonaws.com`

---

## Docker Hub

Las imágenes Docker están publicadas en Docker Hub:

- **Backend**: `nicolasvasquezr02/finagent-backend:latest`
- **Frontend**: `nicolasvasquezr02/finagent-frontend:latest`

### Comandos utilizados para subir (desde la instancia EC2)

```bash
sudo su - appuser

# Login a Docker Hub
docker login
# Ingresar usuario: nicolasvasquezr02
# Ingresar contraseña

# Taggear imágenes
docker tag finagent-backend nicolasvasquezr02/finagent-backend:latest
docker tag finagent-frontend nicolasvasquezr02/finagent-frontend:latest

# Subir imágenes
docker push nicolasvasquezr02/finagent-backend:latest
docker push nicolasvasquezr02/finagent-frontend:latest
```

### Para descargar y usar

```bash
docker pull nicolasvasquezr02/finagent-backend:latest
docker pull nicolasvasquezr02/finagent-frontend:latest
```

---

## Pruebas de Alta Disponibilidad

Se realizaron pruebas para verificar que el ALB maneja correctamente la caída de una instancia:

### Prueba 1: Apagar AZ-b

1. EC2 → Instances → finagent-ec2-az-b → Instance state → **Stop instance**
2. Esperar ~1 minuto para que el ALB detecte la instancia caída
3. Acceder al ALB → **La app sigue funcionando** (tráfico redirigido a AZ-a)

### Prueba 2: Apagar AZ-a, encender AZ-b

1. Encender finagent-ec2-az-b → Instance state → **Start instance**
2. Apagar finagent-ec2-az-a → Instance state → **Stop instance**
3. Acceder al ALB → **La app sigue funcionando** (tráfico redirigido a AZ-b)

### Resultado

El ALB detecta automáticamente la instancia caída mediante health checks y redirige todo el tráfico a la instancia activa, garantizando disponibilidad continua del servicio.

> **Nota**: Cada instancia tiene su propia base de datos PostgreSQL independiente, por lo que los datos ingresados en una instancia no se replican a la otra. En un entorno de producción real se usaría Amazon RDS para tener una base de datos compartida.

---

## Aprendizajes y Conclusiones

### Sobre Docker y Contenedores

- **Docker Compose simplifica orquestación**: con un solo archivo `docker-compose.yml` se levantan 3 servicios interconectados con redes y volúmenes configurados.
- **Los volúmenes persisten datos entre reinicios**: al cambiar modelos de BD, hay que borrar el volumen (`docker compose down -v`) para recrear las tablas. En producción se usarían migraciones con Alembic.
- **El build multi-stage reduce tamaño de imagen**: el Dockerfile del frontend usa Node solo para compilar React y luego copia los archivos estáticos a una imagen Nginx mucho más liviana.
- **buildx es necesario en versiones recientes**: Docker Compose moderno requiere el plugin buildx para hacer builds. En Amazon Linux 2023 no viene preinstalado y hay que agregarlo manualmente.
- **Usuario sin root es buena práctica**: Docker se ejecuta con el usuario `appuser` agregado al grupo docker, evitando correr contenedores como root.

### Sobre AWS

- **VPC "and more" ahorra mucho tiempo**: la opción completa genera automáticamente subredes, Internet Gateway, NAT Gateway y Route Tables en ~2 minutos.
- **Subredes públicas vs privadas**: las instancias en subredes privadas son más seguras pero mucho más difíciles de acceder para debugging. En un Learner Lab académico, las subredes públicas son más prácticas. En producción se usarían subredes privadas con un bastion host.
- **EC2 Instance Connect requiere IP pública o endpoint en la misma subnet**: si la instancia no tiene IP pública, se necesita un EC2 Instance Connect Endpoint configurado correctamente en la misma subnet.
- **SSM Session Manager requiere IAM role**: sin el rol `AmazonSSMManagedInstanceCore`, Session Manager no puede conectarse a la instancia.
- **Security Groups son stateful**: solo se configuran reglas de entrada (inbound). El tráfico de respuesta se permite automáticamente.
- **El ALB hace health checks automáticos**: verifica periódicamente que las instancias respondan y solo envía tráfico a las que están sanas. Esto es la base de la alta disponibilidad.
- **User Data se ejecuta una sola vez al arrancar**: si el script falla (por ejemplo, por falta de buildx), hay que conectarse manualmente para debuggear y corregir.

### Sobre el Desarrollo Full-Stack

- **API centralizada en el frontend**: tener un archivo `api.js` evita duplicación de código fetch y facilita el manejo de errores en un solo lugar.
- **Pydantic valida datos rigurosamente**: un campo `str` vs `Optional[str]` puede causar un error 500 si la BD devuelve `None`. Hay que ser explícito con los tipos.
- **React keys y re-renders**: usar `key` en un div padre puede causar re-mounts innecesarios de todo el árbol de componentes. Es mejor pasar props específicas para trigger re-fetches.
- **Nginx como proxy reverso unifica la URL**: el usuario accede a una sola URL y Nginx decide si servir archivos estáticos (React) o hacer proxy al backend (FastAPI).
- **Las claves de diccionarios deben coincidir exactamente**: un error tan simple como `"ingreso"` vs `"ingresos"` puede causar un KeyError difícil de detectar sin logs.

### Sobre la IA

- **scikit-learn es suficiente para clasificación simple**: no se necesita un modelo pesado de deep learning para clasificar texto corto. TF-IDF + Naive Bayes funciona muy bien para descripciones de gastos.
- **char_wb ngrams capturan variantes**: usar n-gramas de caracteres en vez de palabras permite que el modelo reconozca variantes como "uber", "Uber", "uber al trabajo" sin preprocesamiento complejo.
- **Re-entrenamiento dinámico**: entrenar el modelo cada vez que se crea una transacción o categoría permite que mejore con el uso. El entrenamiento es instantáneo porque el dataset es pequeño.
- **Categorías nuevas sin datos históricos**: para categorías que el usuario crea sin ejemplos previos, se generan variantes automáticas ("pago X", "gasto X", "compra X") como semilla mínima.

### Sobre el Proceso Colaborativo

- **Iterar rápido y corregir sobre la marcha**: es más eficiente desplegar, probar y arreglar bugs que intentar que todo sea perfecto desde el inicio.
- **Los errores enseñan más que el código que funciona**: cada bug encontrado (KeyError, schema mismatch, buildx, subredes privadas) profundizó el entendimiento del stack y de AWS.
- **Documentar todo el proceso**: este README sirve como referencia para futuros proyectos y como evidencia del aprendizaje obtenido.

---

## Recursos AWS Creados — Resumen

| Recurso | Nombre | Detalle |
|---------|--------|---------|
| VPC | finagent-vpc | 10.0.0.0/16 |
| Subnet pública 1a | finagent-subnet-public1-us-east-1a | us-east-1a (ALB) |
| Subnet pública 1b | finagent-subnet-public2-us-east-1b | us-east-1b (ALB) |
| Subnet privada 1a | finagent-subnet-private1-us-east-1a | us-east-1a (EC2 az-a) |
| Subnet privada 1b | finagent-subnet-private2-us-east-1b | us-east-1b (EC2 az-b) |
| Internet Gateway | finagent-igw | Asociado a VPC |
| NAT Gateway | finagent-nat | En 1 AZ (salida a internet para subnets privadas) |
| EC2 AZ-a | finagent-ec2-az-a | t2.micro, subnet privada, frontend + backend + PostgreSQL |
| EC2 AZ-b | finagent-ec2-az-b | t2.micro, subnet privada, frontend + backend (BD en AZ-a) |
| ALB | alb-finagent | Internet-facing, subnets públicas, HTTP:80 |
| Target Group | tg-finagent | HTTP:80, health check: / |
| SG ALB | 1sg-alb-finagent | HTTP 80 desde 0.0.0.0/0 |
| SG EC2 | 2sg-ec2-finagent | HTTP 80 desde ALB + SSH 22 + TCP 5432 entre EC2s |
| SG DB | 3sg-db-finagent | TCP 5432 desde EC2 |

---

## Autores

**Nicolás Vásquez R. - Jorge Luis Fong Gutierrez**
Universidad Autónoma de Occidente
Marzo 2026
