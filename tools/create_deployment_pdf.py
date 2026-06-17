from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "Auto-Parts-CRM-AWS-Deployment-Guide.pdf"


def p(text, style):
    return Paragraph(text, style)


def code_block(lines, styles):
    content = "<br/>".join(line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for line in lines)
    table = Table([[Paragraph(content, styles["Code"])]], colWidths=[6.45 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7FAFD")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D9E2EF")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 8)])


def callout(title, text, styles):
    body = Paragraph(f"<b>{title}:</b> {text}", styles["Callout"])
    table = Table([[body]], colWidths=[6.45 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF8FF")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#B7D7F1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 8)])


def bullet_list(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=colors.HexColor("#2E74B5"),
    )


def number_list(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["Body"]), leftIndent=14) for item in items],
        bulletType="1",
        leftIndent=22,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=9,
        bulletColor=colors.HexColor("#2E74B5"),
    )


def matrix(headers, rows, widths, styles):
    data = [[Paragraph(h, styles["TableHeader"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(cell, styles["TableBody"]) for cell in row])
    table = Table(data, colWidths=[w * inch for w in widths], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0B2545")),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#C9D8EA")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for row_index in range(1, len(data)):
        fill = "#FFFFFF" if row_index % 2 else "#F4F8FD"
        style.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor(fill)))
    table.setStyle(TableStyle(style))
    return KeepTogether([table, Spacer(1, 10)])


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=32,
            textColor=colors.HexColor("#0B2545"),
            spaceAfter=8,
            alignment=TA_LEFT,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#5B6C7E"),
            spaceAfter=16,
        ),
        "Kicker": ParagraphStyle(
            "Kicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#2E74B5"),
            spaceAfter=3,
        ),
        "H1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15.5,
            leading=19,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "H2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.3,
            leading=13.3,
            textColor=colors.HexColor("#222F3E"),
            spaceAfter=6,
        ),
        "Code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.2,
            leading=10.6,
            textColor=colors.HexColor("#1F2A37"),
        ),
        "Callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.8,
            leading=13,
            textColor=colors.HexColor("#222F3E"),
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.8,
            leading=11,
            textColor=colors.HexColor("#0B2545"),
        ),
        "TableBody": ParagraphStyle(
            "TableBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=11.2,
            textColor=colors.HexColor("#222F3E"),
        ),
        "Footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.HexColor("#6B7280"),
        ),
    }
    return styles


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = LETTER
    canvas.setStrokeColor(colors.HexColor("#D9E2EF"))
    canvas.setLineWidth(0.5)
    canvas.line(inch, height - 0.55 * inch, width - inch, height - 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(inch, height - 0.45 * inch, "Auto Parts CRM | AWS Deployment Guide")
    canvas.drawRightString(width - inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_story(styles):
    story = []
    story.append(p("DEPLOYMENT GUIDE", styles["Kicker"]))
    story.append(p("Auto Parts CRM", styles["Title"]))
    story.append(p("AWS deployment process using Amazon RDS PostgreSQL", styles["Subtitle"]))
    story.append(
        callout(
            "Use this guide when deploying",
            "Follow the sections in order: create AWS database, prepare server, configure environment variables, run Prisma migrations, build both apps, start services, and configure Nginx/SSL.",
            styles,
        )
    )
    story.append(
        matrix(
            ["Layer", "Recommended AWS service", "Purpose"],
            [
                ["Database", "Amazon RDS for PostgreSQL", "Managed PostgreSQL database for Prisma models."],
                ["Compute", "EC2 Ubuntu", "Runs NestJS backend and Next.js frontend Node servers."],
                ["Cache / Queue", "ElastiCache Redis, optional", "Redis cache and BullMQ support when enabled."],
                ["Proxy", "Nginx on EC2", "Routes frontend and API domains to local Node ports."],
                ["Process manager", "PM2", "Keeps backend and frontend alive after reboot/deploy."],
            ],
            [1.25, 2.05, 3.1],
            styles,
        )
    )
    story.append(p("Production ports: backend runs on <b>3000</b> and frontend runs on <b>3001</b> before Nginx maps them to public domains.", styles["Body"]))

    story.append(p("1. Create AWS RDS PostgreSQL", styles["H1"]))
    story.append(
        number_list(
            [
                "Open AWS Console, go to RDS > Databases > Create database.",
                "Select PostgreSQL and choose a Dev/Test or Production template.",
                "Use database name <b>auto_parts_crm</b>, then set a strong username and password.",
                "Keep the DB inside your VPC. Prefer private access instead of public access.",
                "Configure the DB security group to allow port <b>5432</b> only from the EC2 server security group.",
                "Enable automated backups and copy the RDS endpoint after creation.",
            ],
            styles,
        )
    )
    story.append(
        code_block(
            ['DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@RDS_ENDPOINT:5432/auto_parts_crm?schema=public"'],
            styles,
        )
    )

    story.append(p("2. Prepare EC2 Ubuntu Server", styles["H1"]))
    story.append(
        code_block(
            [
                "sudo apt update",
                "sudo apt install -y git nginx",
                "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -",
                "sudo apt install -y nodejs",
                "sudo npm install -g pm2",
            ],
            styles,
        )
    )
    story.append(
        code_block(
            [
                "git clone <your-repo-url>",
                "cd auto-parts-crm",
                "npm install --prefix backend",
                "npm install --prefix frontend",
            ],
            styles,
        )
    )

    story.append(p("3. Backend Environment", styles["H1"]))
    story.append(p("Create <b>backend/.env</b> with production values:", styles["Body"]))
    story.append(
        code_block(
            [
                'DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@RDS_ENDPOINT:5432/auto_parts_crm?schema=public"',
                'JWT_SECRET="use-a-long-secure-random-secret"',
                "JWT_EXPIRES_IN_SECONDS=86400",
                'REDIS_HOST="your-redis-host-or-127.0.0.1"',
                "REDIS_PORT=6379",
                'REDIS_USERNAME=""',
                'REDIS_PASSWORD=""',
                "REDIS_DB=0",
                "REDIS_CACHE_ENABLED=true",
                'REDIS_CACHE_KEY_PREFIX="auto-parts-crm:cache:"',
                "REDIS_TLS_ENABLED=false",
                "REDIS_CONNECT_TIMEOUT_MS=5000",
                "ORDERS_CACHE_TTL_SECONDS=60",
                'BULLMQ_PREFIX="auto-parts-crm"',
            ],
            styles,
        )
    )
    story.append(
        callout(
            "Redis note",
            "If Redis is not deployed yet, set REDIS_CACHE_ENABLED=false. If BullMQ workers are required, deploy Redis through AWS ElastiCache or another managed Redis service.",
            styles,
        )
    )
    story.append(p("4. Frontend Environment", styles["H1"]))
    story.append(p("Create <b>frontend/.env.production</b>:", styles["Body"]))
    story.append(
        code_block(
            [
                'NEXT_PUBLIC_APP_NAME="Auto Parts CRM"',
                'NEXT_PUBLIC_APP_URL="https://your-domain.com"',
                "NEXT_PUBLIC_API_TIMEOUT_MS=10000",
                "NEXT_PUBLIC_TOAST_DURATION_MS=5000",
                'BACKEND_API_URL="https://api.your-domain.com"',
                "BACKEND_API_TIMEOUT_MS=10000",
                "AUTH_COOKIE_MAX_AGE_SECONDS=86400",
            ],
            styles,
        )
    )

    story.append(p("5. Run Prisma Production Migration", styles["H1"]))
    story.append(p("Run production migrations against the RDS database. Use <b>migrate deploy</b>, not <b>migrate dev</b>, for deployment.", styles["Body"]))
    story.append(code_block(["cd backend", "npm run prisma:generate", "npx prisma migrate deploy", "cd .."], styles))

    story.append(p("6. Build Backend And Frontend", styles["H1"]))
    story.append(p("On Linux EC2:", styles["Body"]))
    story.append(code_block(["npm run build --prefix backend", "npm run build --prefix frontend"], styles))
    story.append(p("On Windows local machine:", styles["Body"]))
    story.append(code_block(["npm.cmd run build --prefix backend", "npm.cmd run build --prefix frontend"], styles))

    story.append(PageBreak())
    story.append(p("7. Start Production Apps With PM2", styles["H1"]))
    story.append(
        code_block(
            [
                'pm2 start "npm run start:prod --prefix backend" --name auto-parts-backend',
                'pm2 start "npm run start --prefix frontend" --name auto-parts-frontend',
                "pm2 save",
                "pm2 startup",
            ],
            styles,
        )
    )

    story.append(p("8. Configure Nginx Reverse Proxy", styles["H1"]))
    story.append(
        code_block(
            [
                "server {",
                "    server_name your-domain.com;",
                "    location / {",
                "        proxy_pass http://127.0.0.1:3001;",
                "        proxy_http_version 1.1;",
                "        proxy_set_header Host $host;",
                "        proxy_set_header X-Real-IP $remote_addr;",
                "    }",
                "}",
                "",
                "server {",
                "    server_name api.your-domain.com;",
                "    location / {",
                "        proxy_pass http://127.0.0.1:3000;",
                "        proxy_http_version 1.1;",
                "        proxy_set_header Host $host;",
                "        proxy_set_header X-Real-IP $remote_addr;",
                "    }",
                "}",
            ],
            styles,
        )
    )
    story.append(code_block(["sudo apt install -y certbot python3-certbot-nginx", "sudo certbot --nginx"], styles))

    story.append(p("9. Deployment Runbook", styles["H1"]))
    story.append(p("Use this sequence for future deployments:", styles["Body"]))
    story.append(
        code_block(
            [
                "git pull",
                "npm install --prefix backend",
                "npm install --prefix frontend",
                "npm run prisma:generate --prefix backend",
                "cd backend && npx prisma migrate deploy && cd ..",
                "npm run build --prefix backend",
                "npm run build --prefix frontend",
                "pm2 restart auto-parts-backend",
                "pm2 restart auto-parts-frontend",
            ],
            styles,
        )
    )

    story.append(p("10. Production Checklist", styles["H1"]))
    story.append(
        bullet_list(
            [
                "RDS is private and port 5432 is not exposed publicly.",
                "EC2 security group allows HTTP/HTTPS and restricts SSH.",
                "Backend .env uses the RDS endpoint and a strong JWT_SECRET.",
                "Prisma migrate deploy has completed successfully.",
                "Backend build and frontend build both pass.",
                "PM2 shows both processes online.",
                "Nginx routes frontend and API domains correctly.",
                "SSL certificate is installed and auto-renewal is enabled.",
                "RDS automated backups are enabled.",
            ],
            styles,
        )
    )

    story.append(p("References", styles["H1"]))
    story.append(
        bullet_list(
            [
                "AWS RDS PostgreSQL: https://aws.amazon.com/rds/postgresql/",
                "AWS RDS create DB: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html",
                "AWS RDS security groups: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html",
                "Prisma production migrations: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate",
                "Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying",
            ],
            styles,
        )
    )
    return story


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=LETTER,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Auto Parts CRM AWS Deployment Guide",
        author="Codex",
    )
    doc.build(build_story(styles), onFirstPage=header_footer, onLaterPages=header_footer)


if __name__ == "__main__":
    main()
