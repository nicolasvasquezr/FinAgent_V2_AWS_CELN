# 💰 FinAgent — Gestor de Finanzas Personales

Aplicación web para registrar y visualizar gastos e ingresos personales, desplegada en un entorno **Multi-Container altamente disponible en AWS**.

**Práctica 4 — Computación en la Nube | Universidad Autónoma de Occidente**

---

## 🏗️ Arquitectura

```
Internet
    │
    ▼
┌─────────────────────────────────────────────┐
│          Application Load Balancer           │
│              (Puerto 80 público)             │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐   ┌─────────────┐
│  EC2 - AZ-a │   │  EC2 - AZ-b │   ← Subredes privadas
│  (Nginx +   │   │  (Nginx +   │
│   FastAPI)  │   │   FastAPI)  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                ▼
        ┌───────────────┐
        │  PostgreSQL   │   ← Un solo contenedor (en AZ-a)
        │  (Puerto 5432)│
        └───────────────┘

VPC: 10.0.0.0/16
  Subred pública  AZ-a: 10.0.1.0/24  → NAT Gateway
  Subred pública  AZ-b: 10.0.2.0/24  → NAT Gateway
  Subred privada  AZ-a: 10.0.3.0/24  → EC2 + DB
  Subred privada  AZ-b: 10.0.4.0/24  → EC2
```

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Recharts |
| Backend | FastAPI (Python 3.11) |
| Base de datos | PostgreSQL 15 |
| Proxy | Nginx Alpine |
| Contenedores | Docker + Docker Compose |
| Nube | AWS EC2, VPC, ALB |

---

## 📁 Estructura del proyecto

```
finagent/
├── backend/
│   ├── main.py           # API REST (FastAPI)
│   ├── models.py         # Modelos SQLAlchemy
│   ├── schemas.py        # Schemas Pydantic
│   ├── database.py       # Conexión PostgreSQL
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # KPIs + gráficos
│   │   │   ├── Historial.jsx    # Tabla de transacciones
│   │   │   └── Categorias.jsx   # Gestión de categorías
│   │   ├── components/
│   │   │   ├── Modal.jsx
│   │   │   └── TransactionForm.jsx
│   │   └── lib/
│   │       ├── api.js           # Cliente HTTP
│   │       └── utils.js
│   ├── Dockerfile               # Multi-stage build
│   └── package.json
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Despliegue local

### Prerrequisitos
- Docker Desktop instalado y corriendo
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/<tu-usuario>/finagent.git
cd finagent

# 2. Crear archivo de variables de entorno
cp .env.example .env

# 3. Levantar todos los servicios
docker compose up --build

# 4. Abrir en el navegador
# http://localhost
```

> La primera vez tarda ~3 minutos por el build de React (npm install).

### Verificar que funciona

```bash
curl http://localhost/health          # {"status":"ok"}
curl http://localhost:8000/docs       # Swagger UI del backend
```

### Detener

```bash
docker compose down          # detiene y elimina contenedores
docker compose down -v       # también elimina la base de datos
```

---

## ☁️ Despliegue en AWS

### Paso 1 — Crear la infraestructura de red (VPC)

1. En la consola AWS → **VPC** → *Create VPC* → seleccionar **VPC and more**
2. Configurar:
   - **Name**: `finagent-vpc`
   - **IPv4 CIDR**: `10.0.0.0/16`
   - **Number of AZs**: 2
   - **Public subnets**: 2 (una por AZ)
   - **Private subnets**: 2 (una por AZ)
   - **NAT gateways**: 1 per AZ (o "In 1 AZ" para reducir costos en laboratorio)
3. Hacer clic en **Create VPC** y esperar ~2 minutos

### Paso 2 — Crear los Security Groups

**SG para el Load Balancer** (`sg-alb`):
| Tipo | Puerto | Origen |
|------|--------|--------|
| HTTP | 80 | 0.0.0.0/0 |

**SG para las instancias EC2** (`sg-ec2`):
| Tipo | Puerto | Origen |
|------|--------|--------|
| HTTP | 80 | sg-alb (solo desde el ALB) |
| SSH | 22 | Tu IP |

**SG para la base de datos** (`sg-db`):
| Tipo | Puerto | Origen |
|------|--------|--------|
| PostgreSQL | 5432 | sg-ec2 (solo desde EC2) |

### Paso 3 — Lanzar las instancias EC2

Lanzar **2 instancias** (una en cada subred privada):

- **AMI**: Amazon Linux 2023
- **Instance type**: t2.micro (free tier)
- **Key pair**: crear o usar uno existente
- **Network**: `finagent-vpc`
- **Subnet**: subred privada AZ-a para la primera, AZ-b para la segunda
- **Security group**: `sg-ec2`

**User Data** (pegar en ambas instancias al crearlas):

```bash
#!/bin/bash
# Actualizar sistema
yum update -y

# Instalar Docker
yum install -y docker git
systemctl enable docker
systemctl start docker

# Instalar Docker Compose
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Crear usuario sin privilegios root
useradd -m -s /bin/bash appuser
usermod -aG docker appuser

# Clonar el repositorio
su - appuser -c "git clone https://github.com/<tu-usuario>/finagent.git /home/appuser/finagent"

# Crear archivo .env
cat > /home/appuser/finagent/.env << 'EOF'
POSTGRES_DB=finagent
POSTGRES_USER=finagent
POSTGRES_PASSWORD=finagent_secure_2024
EOF
chown appuser:appuser /home/appuser/finagent/.env
```

> ⚠️ **Importante**: En la instancia de AZ-b, el `docker-compose.yml` no debe levantar el servicio `db` (la BD solo corre en AZ-a). Ver sección de configuración multi-instancia más abajo.

### Paso 4 — Configurar Docker en cada instancia

**Instancia AZ-a** (con base de datos):
```bash
su - appuser
cd ~/finagent
docker-compose up -d
```

**Instancia AZ-b** (sin base de datos, apunta a la IP privada de AZ-a):
```bash
su - appuser
cd ~/finagent

# Editar docker-compose para que el backend apunte a la DB en AZ-a
export DB_HOST=<IP-privada-instancia-AZ-a>
sed -i "s|@db:5432|@${DB_HOST}:5432|g" docker-compose.yml

# Levantar solo backend y frontend (sin DB)
docker-compose up -d backend frontend
```

### Paso 5 — Crear el Application Load Balancer

1. **EC2** → **Load Balancers** → *Create Load Balancer* → **Application Load Balancer**
2. Configurar:
   - **Name**: `finagent-alb`
   - **Scheme**: Internet-facing
   - **VPC**: `finagent-vpc`
   - **Subnets**: seleccionar las **2 subredes públicas** (AZ-a y AZ-b)
   - **Security group**: `sg-alb`
3. **Target Group**:
   - **Name**: `finagent-tg`
   - **Protocol**: HTTP, **Port**: 80
   - **Health check path**: `/health`
   - Registrar ambas instancias EC2 como targets
4. **Listener**: HTTP:80 → forward a `finagent-tg`
5. Crear y esperar ~2 minutos

La aplicación será accesible en el **DNS del ALB** que aparece en la consola.

### Paso 6 — Verificar alta disponibilidad

```bash
# Desde tu máquina local, hacer múltiples requests al ALB
for i in {1..10}; do
  curl -s http://<dns-del-alb>/health
  echo ""
done

# Detener manualmente el contenedor en una instancia
# y verificar que el ALB redirige al otro
docker stop finagent_frontend   # en instancia AZ-a

# El ALB debería seguir respondiendo desde AZ-b
curl http://<dns-del-alb>/health   # debe seguir funcionando
```

---

## 🐳 Docker Hub

```bash
# Construir y publicar la imagen del backend
docker build -t <tu-usuario-dockerhub>/finagent-backend:latest ./backend
docker push <tu-usuario-dockerhub>/finagent-backend:latest

# Construir y publicar la imagen del frontend
docker build -t <tu-usuario-dockerhub>/finagent-frontend:latest ./frontend
docker push <tu-usuario-dockerhub>/finagent-frontend:latest
```

Luego en `docker-compose.yml`, reemplazar `build:` por `image:`:
```yaml
backend:
  image: <tu-usuario-dockerhub>/finagent-backend:latest

frontend:
  image: <tu-usuario-dockerhub>/finagent-frontend:latest
```

---

## 🔌 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/api/categories` | Listar categorías |
| POST | `/api/categories` | Crear categoría |
| PUT | `/api/categories/{id}` | Actualizar categoría |
| DELETE | `/api/categories/{id}` | Eliminar categoría |
| GET | `/api/transactions` | Listar transacciones (filtros: month, category, type) |
| POST | `/api/transactions` | Crear transacción |
| PUT | `/api/transactions/{id}` | Actualizar transacción |
| DELETE | `/api/transactions/{id}` | Eliminar transacción |
| GET | `/api/stats?month=YYYY-MM` | Estadísticas del mes |

Documentación interactiva disponible en `http://localhost:8000/docs`

---

## 👤 Autor

**Nicolás Vásquez Renjifo**  
Computación en la Nube — Universidad Autónoma de Occidente