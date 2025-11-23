# FlowBuilder Website Page Map & Tech Overview

## 1) Project Overview

**FlowBuilder** is a smart‑procurement SaaS for construction that replaces fragmented, manual workflows with a centralized, intelligent hub so general contractors can make faster, more cost‑effective decisions. Its core differentiator is an **AI‑assisted RFQ engine** that analyzes project requirements and recommends suppliers based on trade specialty and historical performance.

The platform’s value proposition spans three pillars: a **Centralized Management Hub** (company/users, projects, unified supplier & material databases), an **Intelligent Procurement Module** (AI‑assisted RFQ, quote comparison, one‑click PO), and **Essential Delivery Oversight** (PO status tracking and notifications).

For the **MVP**, FlowBuilder delivers a complete end‑to‑end procurement workflow using one primary persona (Construction Admin), with **pre‑defined suppliers/materials** to reduce setup complexity, while keeping the AI recommendation engine in scope.

For more details access here:
- [FlowBuilder Proposal](https://docs.google.com/document/d/1dcIq8v57Mj9Xqpqe_KVXfqcjYuPzLEL-bFu9XqtypC4/edit?usp=sharing)
- [FlowBuilder Data Model](https://docs.google.com/document/d/10kxlk-s-Pgy1t9cLtLFgyy80KDP1RSMHZ_i7Q3SuRB4/edit?usp=sharing)

---

## 2) Page Map

### Flowchart Diagram (and Jobdesk)

```mermaid
graph TD

%% Phase 1 / MVP
A[Sign In - 陳宇任]:::high --> B(Dashboard - Krisna)
B --> C(Projects - 陳宇任)

C --> C1(Project Detail - 陳宇任)
C --> C2(Manage RFQ - Krisna)
C --> C3(Manage Quote - 張梓榆)

C2 --> C21(Create RFQ - Krisna)
C2 --> C22(Distribute RFQ - Krisna)

C3 --> C31(Submit Quote - 張梓榆)
C3 --> C32(Compare Quote - 張梓榆)
C3 --> C33(Generate PO - 張梓榆)

C --> D(PO Tracker - 陳宇任)


%% Phase 2 / Enhancements
B --> M(Suppliers Directory - 陳宇任)
B --> N(Material Catalog - 張梓榆)
B --> O(Company & Users Management - Krisna)


%% Priority color classes
classDef high fill:#ff9999,color:#000;
classDef medium fill:#fff799,color:#000;
classDef low fill:#a7c7e7,color:#000;

%% High priority: MVP user flows
class A,B,C,D,C1,C2,C3,C21,C31,C32,C33 high;

%% Medium priority: operational features
class M,N,O,C22 medium;
```

### Additional Explanation

- **Create RFQ** embeds **AI Supplier Suggestions** inline (similar to “Get suggestions”), then persists chosen suppliers. Distribution sends the full RFQ package simultaneously to selected suppliers.
- **Submit Quote** is the supplier's submission step results from distribution. Incoming quotes feed a **side‑by‑side comparison** view.
- **Generate PO** converts an awarded quote into a formal **Purchase Order** with one click, carrying line items and totals forward.
- **PO Tracker** manages a simple workflow (Ordered → Confirmed → Shipped → Delivered) and notifies stakeholders on status changes.
- **Phase 2** introduces the **Suppliers Directory** and **Material Catalog** (company‑owned), plus **Company & Users Management** with RBAC—these power richer operations and multi‑tenant scale.

---

## 3) Tech Stack

- Frontend: **HTMX** + **TailwindCSS**
- Backend: **Express (TypeScript)**
- Database: **PostgreSQL**

---

## 4) Team Member

- M11405103 張梓榆 (CEO)
- M11402802 I Putu Krisna Erlangga (CTO)
- M11405507 陳宇任 (CFO)

---

## 5) Entity Relationship Diagram (ERD)

```mermaid
erDiagram

    Role {
        INTEGER id PK
        VARCHAR name
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    User {
        INTEGER id PK
        INTEGER role_id FK
        INTEGER company_id FK
        VARCHAR name
        VARCHAR email
        VARCHAR password
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Company {
        INTEGER id PK
        VARCHAR name
        TEXT address
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CompanySupplier {
        INTEGER company_id FK
        INTEGER supplier_id FK
        TEXT notes
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Supplier {
        INTEGER id PK
        INTEGER company_id FK
        VARCHAR name
        VARCHAR email
        VARCHAR password
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Project {
        INTEGER id PK
        INTEGER company_id FK
        VARCHAR name
        VARCHAR description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Material {
        INTEGER id PK
        INTEGER company_id FK
        VARCHAR name
        VARCHAR sku
        VARCHAR unit
        TIMESTAMP createdAt
        TIMESTAMP updatedAt
    }

    RFQ {
        INTEGER id PK
        INTEGER project_id FK
        VARCHAR name
        TIMESTAMP deadline
        VARCHAR status
        INTEGER created_by
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    RFQSupplier {
        INTEGER rfq_id FK
        INTEGER supplier_id FK
    }

    RFQMaterial {
        INTEGER rfq_id FK
        INTEGER material_id FK
        INTEGER quantity
    }

    Quote {
        INTEGER id PK
        INTEGER rfq_id FK
        INTEGER supplier_id FK
        TIMESTAMP duration
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    QuoteItem {
        INTEGER id PK
        INTEGER quote_id FK
        INTEGER material_id FK
        INTEGER price
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PO {
        INTEGER id PK
        INTEGER quote_id FK
        VARCHAR status
        INTEGER created_by
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    %% Relationships
    Role ||--o{ User : "assigned_to"
    Company ||--o{ User : "employs"
    Company ||--o{ Project : "owns"
    Company ||--o{ Material : "stocks"
    Company ||--o{ Supplier : "manages_record"
    
    Company ||--o{ CompanySupplier : "partners_with"
    Supplier ||--o{ CompanySupplier : "partnered_by"

    Project ||--o{ RFQ : "initiates"
    
    RFQ ||--o{ RFQSupplier : "sent_to"
    Supplier ||--o{ RFQSupplier : "receives"

    RFQ ||--o{ RFQMaterial : "requests"
    Material ||--o{ RFQMaterial : "listed_in"

    RFQ ||--o{ Quote : "generates"
    Supplier ||--o{ Quote : "submits"

    Quote ||--o{ QuoteItem : "contains"
    Material ||--o{ QuoteItem : "priced_as"

    Quote ||--o{ PO : "converts_to"
```
