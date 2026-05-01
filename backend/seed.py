"""
Seed script for HDI Consultores LMS
Run from backend/ directory:  python seed.py
"""
import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.domain import (
    Rubro,
    Area,
    Cliente,
    Empleado,
    Capacitacion,
    CapacitacionProgramada,
    AsignacionCapacitacion,
    Pregunta,
    Material,
)
from datetime import datetime, timezone
import json


def seed():
    db = SessionLocal()

    try:
        # ── Check if data already exists ──
        existing = db.query(Cliente).first()
        if existing:
            print("⚠️  La base de datos ya tiene datos. Abortando seed para evitar duplicados.")
            print("   Si querés re-seedear, vaciá las tablas primero.")
            return

        print("🌱 Iniciando seed de datos...")

        # ═══════════════════════════════════════
        # 1. RUBROS
        # ═══════════════════════════════════════
        rubros_data = ["Transporte", "Logística", "Construcción", "Industria", "Servicios"]
        rubros = []
        for nombre in rubros_data:
            r = Rubro(nombre=nombre, activo=True)
            db.add(r)
            rubros.append(r)
        db.flush()
        print(f"   ✅ {len(rubros)} rubros creados")

        # ═══════════════════════════════════════
        # 2. ÁREAS
        # ═══════════════════════════════════════
        areas_data = ["Choferes", "Administración", "Depósito", "Operaciones", "Mantenimiento", "RRHH"]
        areas = []
        for nombre in areas_data:
            a = Area(nombre=nombre, activo=True)
            db.add(a)
            areas.append(a)
        db.flush()
        print(f"   ✅ {len(areas)} áreas creadas")

        # ═══════════════════════════════════════
        # 3. CLIENTES
        # ═══════════════════════════════════════
        clientes_data = [
            {"razon_social": "Kimberly-Clark Argentina S.A.", "cuit": "30-50000001-9", "rubro": rubros[0], "areas": [areas[0], areas[2], areas[3]]},
            {"razon_social": "FourKites Logistics S.R.L.",    "cuit": "30-50000002-7", "rubro": rubros[1], "areas": [areas[1], areas[3], areas[5]]},
            {"razon_social": "Constructora del Sur S.A.",     "cuit": "30-50000003-5", "rubro": rubros[2], "areas": [areas[0], areas[3], areas[4]]},
        ]
        clientes = []
        for cd in clientes_data:
            c = Cliente(
                razon_social=cd["razon_social"],
                cuit=cd["cuit"],
                rubro_id=cd["rubro"].id,
                activo=True,
            )
            c.areas = cd["areas"]
            db.add(c)
            clientes.append(c)
        db.flush()
        print(f"   ✅ {len(clientes)} clientes creados")

        # ═══════════════════════════════════════
        # 4. EMPLEADOS
        # ═══════════════════════════════════════
        empleados_data = [
            # Cliente 0 – Kimberly
            {"nombre_completo": "Juan Pérez",     "dni": "30123456", "email": "jperez@kimberly.com",    "cliente": clientes[0], "areas": [areas[0]]},
            {"nombre_completo": "María García",   "dni": "30123457", "email": "mgarcia@kimberly.com",   "cliente": clientes[0], "areas": [areas[2]]},
            {"nombre_completo": "Carlos López",   "dni": "30123458", "email": "clopez@kimberly.com",    "cliente": clientes[0], "areas": [areas[3]]},
            {"nombre_completo": "Ana Rodríguez",  "dni": "30123459", "email": "arodriguez@kimberly.com","cliente": clientes[0], "areas": [areas[0]]},
            # Cliente 1 – FourKites
            {"nombre_completo": "Pedro Martínez", "dni": "30223456", "email": "pmartinez@fourkites.com","cliente": clientes[1], "areas": [areas[1]]},
            {"nombre_completo": "Laura Fernández","dni": "30223457", "email": "lfernandez@fourkites.com","cliente": clientes[1], "areas": [areas[3]]},
            {"nombre_completo": "Diego Sánchez",  "dni": "30223458", "email": "dsanchez@fourkites.com", "cliente": clientes[1], "areas": [areas[5]]},
            # Cliente 2 – Constructora
            {"nombre_completo": "Roberto Díaz",   "dni": "30323456", "email": "rdiaz@constructora.com", "cliente": clientes[2], "areas": [areas[0]]},
            {"nombre_completo": "Lucía Moreno",   "dni": "30323457", "email": "lmoreno@constructora.com","cliente": clientes[2], "areas": [areas[4]]},
        ]
        empleados = []
        for i, ed in enumerate(empleados_data):
            e = Empleado(
                nombre_completo=ed["nombre_completo"],
                dni=ed["dni"],
                email=ed["email"],
                cliente_id=ed["cliente"].id,
                uid_firebase=f"EMP-{i+1}",
                activo=True,
            )
            e.areas = ed["areas"]
            db.add(e)
            empleados.append(e)
        db.flush()
        print(f"   ✅ {len(empleados)} empleados creados")

        # ═══════════════════════════════════════
        # 5. CAPACITACIONES (Catálogo de Cursos)
        # ═══════════════════════════════════════
        capacitaciones_data = [
            {
                "nombre": "Manejo Defensivo",
                "descripcion": "Técnicas de conducción segura y prevención de accidentes viales.",
                "duracion_horas": 4,
                "modalidad": "presencial",
                "requiere_evaluacion": True,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 7.0,
                "meses_vigencia": 12,
                "rubro": rubros[0],
                "area": areas[0],
            },
            {
                "nombre": "Uso de Extintores",
                "descripcion": "Capacitación práctica sobre el uso correcto de extintores y protocolos de incendio.",
                "duracion_horas": 2,
                "modalidad": "presencial",
                "requiere_evaluacion": True,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 7.0,
                "meses_vigencia": 12,
                "rubro": None,
                "area": None,
            },
            {
                "nombre": "Trabajo en Altura",
                "descripcion": "Normas de seguridad para trabajos en alturas superiores a 2 metros.",
                "duracion_horas": 8,
                "modalidad": "presencial",
                "requiere_evaluacion": True,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 8.0,
                "meses_vigencia": 6,
                "rubro": rubros[2],
                "area": areas[4],
            },
            {
                "nombre": "Prevención de Riesgos Laborales",
                "descripcion": "Marco legal y prácticas fundamentales de seguridad e higiene en el trabajo.",
                "duracion_horas": 3,
                "modalidad": "virtual",
                "requiere_evaluacion": True,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 7.0,
                "meses_vigencia": 12,
                "rubro": None,
                "area": None,
            },
            {
                "nombre": "Ergonomía en Depósito",
                "descripcion": "Técnicas de levantamiento manual de cargas y prevención de lesiones musculoesqueléticas.",
                "duracion_horas": 2,
                "modalidad": "presencial",
                "requiere_evaluacion": False,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 7.0,
                "meses_vigencia": 12,
                "rubro": rubros[1],
                "area": areas[2],
            },
            {
                "nombre": "Primeros Auxilios",
                "descripcion": "Protocolo RCP, atención de heridas, quemaduras y emergencias médicas.",
                "duracion_horas": 6,
                "modalidad": "presencial",
                "requiere_evaluacion": True,
                "puntaje_total": 10.0,
                "puntaje_aprobacion": 7.5,
                "meses_vigencia": 12,
                "rubro": None,
                "area": None,
            },
        ]
        capacitaciones = []
        for cd in capacitaciones_data:
            cap = Capacitacion(
                nombre=cd["nombre"],
                descripcion=cd["descripcion"],
                duracion_horas=cd["duracion_horas"],
                modalidad=cd["modalidad"],
                requiere_evaluacion=cd["requiere_evaluacion"],
                puntaje_total=cd["puntaje_total"],
                puntaje_aprobacion=cd["puntaje_aprobacion"],
                meses_vigencia=cd["meses_vigencia"],
                activa=True,
                rubro_id=cd["rubro"].id if cd["rubro"] else None,
                area_id=cd["area"].id if cd["area"] else None,
            )
            db.add(cap)
            capacitaciones.append(cap)
        db.flush()
        print(f"   ✅ {len(capacitaciones)} capacitaciones creadas")

        # ═══════════════════════════════════════
        # 6. PREGUNTAS (banco de preguntas por capacitación)
        # ═══════════════════════════════════════
        preguntas_por_cap = {
            0: [  # Manejo Defensivo
                {"texto": "¿Cuál es la distancia mínima de seguimiento recomendada?",
                 "opciones": [
                     {"id": 1, "texto": "1 segundo", "es_correcta": False},
                     {"id": 2, "texto": "3 segundos", "es_correcta": True},
                     {"id": 3, "texto": "5 metros", "es_correcta": False},
                 ]},
                {"texto": "¿Qué se debe hacer ante un encandilamiento nocturno?",
                 "opciones": [
                     {"id": 1, "texto": "Mirar directamente las luces", "es_correcta": False},
                     {"id": 2, "texto": "Desviar la mirada hacia la línea de banquina", "es_correcta": True},
                     {"id": 3, "texto": "Acelerar para pasar rápido", "es_correcta": False},
                 ]},
            ],
            1: [  # Uso de Extintores
                {"texto": "¿Cuál es el primer paso al usar un extintor?",
                 "opciones": [
                     {"id": 1, "texto": "Apuntar a la base del fuego", "es_correcta": False},
                     {"id": 2, "texto": "Quitar el seguro", "es_correcta": True},
                     {"id": 3, "texto": "Presionar la palanca", "es_correcta": False},
                 ]},
            ],
            3: [  # Prevención de Riesgos
                {"texto": "¿Qué ley regula la seguridad e higiene en Argentina?",
                 "opciones": [
                     {"id": 1, "texto": "Ley 19.587", "es_correcta": True},
                     {"id": 2, "texto": "Ley 20.744", "es_correcta": False},
                     {"id": 3, "texto": "Ley 24.557", "es_correcta": False},
                 ]},
            ],
            5: [  # Primeros Auxilios
                {"texto": "¿Cuál es la frecuencia correcta de compresiones en RCP adulto?",
                 "opciones": [
                     {"id": 1, "texto": "60 por minuto", "es_correcta": False},
                     {"id": 2, "texto": "100-120 por minuto", "es_correcta": True},
                     {"id": 3, "texto": "150 por minuto", "es_correcta": False},
                 ]},
            ],
        }
        total_preguntas = 0
        for cap_idx, preguntas in preguntas_por_cap.items():
            for p_data in preguntas:
                p = Pregunta(
                    capacitacion_id=capacitaciones[cap_idx].id,
                    texto=p_data["texto"],
                    opciones_json=json.dumps(p_data["opciones"], ensure_ascii=False),
                )
                db.add(p)
                total_preguntas += 1
        db.flush()
        print(f"   ✅ {total_preguntas} preguntas creadas")

        # ═══════════════════════════════════════
        # 7. PROGRAMADAS (para cliente Kimberly, año 2026)
        # ═══════════════════════════════════════
        programadas_data = [
            {"cliente": clientes[0], "cap": capacitaciones[0], "mes": 3, "anio": 2026, "tipo": "ANUAL",  "modalidad": "presencial", "eval": True,  "estado": "ACTIVA"},
            {"cliente": clientes[0], "cap": capacitaciones[1], "mes": 4, "anio": 2026, "tipo": "ANUAL",  "modalidad": "presencial", "eval": True,  "estado": "PROGRAMADA"},
            {"cliente": clientes[0], "cap": capacitaciones[3], "mes": 5, "anio": 2026, "tipo": "ANUAL",  "modalidad": "virtual",    "eval": True,  "estado": "PROGRAMADA"},
            {"cliente": clientes[0], "cap": capacitaciones[5], "mes": 6, "anio": 2026, "tipo": "ANUAL",  "modalidad": "presencial", "eval": True,  "estado": "PROGRAMADA"},
            {"cliente": clientes[1], "cap": capacitaciones[3], "mes": 4, "anio": 2026, "tipo": "ANUAL",  "modalidad": "virtual",    "eval": True,  "estado": "PROGRAMADA"},
            {"cliente": clientes[1], "cap": capacitaciones[4], "mes": 5, "anio": 2026, "tipo": "ANUAL",  "modalidad": "presencial", "eval": False, "estado": "PROGRAMADA"},
            {"cliente": clientes[2], "cap": capacitaciones[2], "mes": 3, "anio": 2026, "tipo": "ANUAL",  "modalidad": "presencial", "eval": True,  "estado": "ACTIVA"},
        ]
        programadas = []
        for pd_item in programadas_data:
            prog = CapacitacionProgramada(
                cliente_id=pd_item["cliente"].id,
                capacitacion_id=pd_item["cap"].id,
                mes=pd_item["mes"],
                anio=pd_item["anio"],
                tipo=pd_item["tipo"],
                modalidad_final=pd_item["modalidad"],
                requiere_evaluacion_final=pd_item["eval"],
                estado=pd_item["estado"],
                generada_automaticamente=False,
                alcance_asignacion="TODOS",
                fecha_activacion=datetime.now(timezone.utc) if pd_item["estado"] == "ACTIVA" else None,
            )
            db.add(prog)
            programadas.append(prog)
        db.flush()
        print(f"   ✅ {len(programadas)} programadas creadas")

        # ═══════════════════════════════════════
        # 8. ASIGNACIONES (para programadas ACTIVAS)
        # ═══════════════════════════════════════
        asignaciones_data = [
            # Programada 0 (Kimberly - Manejo Defensivo ACTIVA) → empleados de Kimberly
            {"empleado": empleados[0], "cap": capacitaciones[0], "cliente": clientes[0], "programada": programadas[0], "estado": "aprobado"},
            {"empleado": empleados[1], "cap": capacitaciones[0], "cliente": clientes[0], "programada": programadas[0], "estado": "pendiente"},
            {"empleado": empleados[2], "cap": capacitaciones[0], "cliente": clientes[0], "programada": programadas[0], "estado": "en_curso"},
            {"empleado": empleados[3], "cap": capacitaciones[0], "cliente": clientes[0], "programada": programadas[0], "estado": "pendiente"},
            # Programada 6 (Constructora - Trabajo en Altura ACTIVA) → empleados de Constructora
            {"empleado": empleados[7], "cap": capacitaciones[2], "cliente": clientes[2], "programada": programadas[6], "estado": "en_curso"},
            {"empleado": empleados[8], "cap": capacitaciones[2], "cliente": clientes[2], "programada": programadas[6], "estado": "pendiente"},
        ]
        for ad in asignaciones_data:
            asig = AsignacionCapacitacion(
                cliente_id=ad["cliente"].id,
                empleado_id=ad["empleado"].id,
                capacitacion_id=ad["cap"].id,
                programada_id=ad["programada"].id,
                estado=ad["estado"],
                origen="masiva",
            )
            db.add(asig)
        db.flush()
        print(f"   ✅ {len(asignaciones_data)} asignaciones creadas")

        # ═══════════════════════════════════════
        # COMMIT
        # ═══════════════════════════════════════
        db.commit()
        print("\n🎉 Seed completado exitosamente!")
        print(f"   Resumen:")
        print(f"   • {len(rubros)} rubros")
        print(f"   • {len(areas)} áreas")
        print(f"   • {len(clientes)} clientes")
        print(f"   • {len(empleados)} empleados")
        print(f"   • {len(capacitaciones)} capacitaciones")
        print(f"   • {total_preguntas} preguntas")
        print(f"   • {len(programadas)} programadas")
        print(f"   • {len(asignaciones_data)} asignaciones")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error durante el seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()