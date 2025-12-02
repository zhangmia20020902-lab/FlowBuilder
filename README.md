# FlowBuilder Website Page Map & Tech Overview

## 1) Project Overview

**FlowBuilder** is a smart‑procurement SaaS for construction that replaces fragmented, manual workflows with a centralized, intelligent hub so general contractors can make faster, more cost‑effective decisions. Its core differentiator is an **AI‑assisted RFQ engine** that analyzes project requirements and recommends suppliers based on trade specialty and historical performance.

The platform’s value proposition spans three pillars: a **Centralized Management Hub** (company/users, projects, unified supplier & material databases), an **Intelligent Procurement Module** (AI‑assisted RFQ, quote comparison, one‑click PO), and **Essential Delivery Oversight** (PO status tracking and notifications).

For the **MVP**, FlowBuilder delivers a complete end‑to‑end procurement workflow using one primary persona (Construction Admin), with **pre‑defined suppliers/materials** to reduce setup complexity, while keeping the AI recommendation engine in scope.

For more details access here:

- Project Proposal: [FlowBuilder Proposal](https://docs.google.com/document/d/1dcIq8v57Mj9Xqpqe_KVXfqcjYuPzLEL-bFu9XqtypC4/edit?usp=sharing)
- Data Model: [FlowBuilder Data Model](https://docs.google.com/document/d/10kxlk-s-Pgy1t9cLtLFgyy80KDP1RSMHZ_i7Q3SuRB4/edit?usp=sharing)

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

- Frontend: **HTMX** + **Boostrap** + **HJS**
- Backend: **Express**
- Database: **MySQL**
- Logging: **Winston** + **Morgan**

---

## 5) Team Member

- M11405103 張梓榆 (CEO)
- M11402802 I Putu Krisna Erlangga (CTO)
- M11405507 陳宇任 (CFO)

---

## 6) Entity Relationship Diagram (ERD)

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
        VARCHAR type "client or supplier"
        TEXT address
        VARCHAR phone
        VARCHAR email
        VARCHAR trade_specialty "supplier only"
        TEXT description
        TEXT notes
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CompanyPartnership {
        INTEGER source_company_id FK "client company"
        INTEGER target_company_id FK "supplier company"
        TEXT notes
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Project {
        INTEGER id PK
        INTEGER company_id FK
        VARCHAR name
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Category {
        INTEGER id PK
        VARCHAR name
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Material {
        INTEGER id PK
        INTEGER company_id FK
        INTEGER category_id FK
        VARCHAR name
        VARCHAR sku
        VARCHAR unit
        DECIMAL price_avg
        DECIMAL price_stdev
        INTEGER sample_count
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CompanyMaterial {
        INTEGER company_id FK "supplier company"
        INTEGER material_id FK
        DECIMAL last_price
        DATE last_transaction_date
        INTEGER transaction_count
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    RFQ {
        INTEGER id PK
        INTEGER project_id FK
        INTEGER created_by FK "user"
        VARCHAR name
        DATETIME deadline
        VARCHAR status "draft, open, closed"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    RFQSupplier {
        INTEGER rfq_id FK
        INTEGER company_id FK "supplier company"
        VARCHAR status
        DATETIME notified_at
        DATETIME responded_at
    }

    RFQMaterial {
        INTEGER rfq_id FK
        INTEGER material_id FK
        INTEGER quantity
    }

    Quote {
        INTEGER id PK
        INTEGER rfq_id FK
        INTEGER company_id FK "supplier company"
        INTEGER duration
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    QuoteItem {
        INTEGER id PK
        INTEGER quote_id FK
        INTEGER material_id FK
        DECIMAL price
        INTEGER quantity
        DECIMAL discount_rate
        DECIMAL original_unit_price
        DECIMAL total_price
        VARCHAR external_ref
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PO {
        INTEGER id PK
        INTEGER quote_id FK
        INTEGER created_by FK "user"
        VARCHAR status "ordered, confirmed, shipped, delivered"
        TEXT notes
        DATETIME cancelled_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    Session {
        VARCHAR session_id PK
        INTEGER expires
        MEDIUMTEXT data
    }

    Notification {
        INTEGER id PK
        INTEGER user_id FK
        VARCHAR type
        INTEGER reference_id
        TEXT message
        BOOLEAN is_read
        TIMESTAMP created_at
    }

    %% Relationships
    Role ||--o{ User : "assigned_to"
    Company ||--o{ User : "employs"
    Company ||--o{ Project : "owns"
    Company ||--o{ Material : "stocks"
    Company ||--o{ CompanyMaterial : "supplies"
    Company ||--o{ CompanyPartnership : "initiates"
    Company ||--o{ CompanyPartnership : "receives"

    Category ||--o{ Material : "categorizes"

    Material ||--o{ CompanyMaterial : "listed_in"
    Material ||--o{ RFQMaterial : "listed_in"
    Material ||--o{ QuoteItem : "priced_as"

    Project ||--o{ RFQ : "initiates"

    RFQ ||--o{ RFQSupplier : "sent_to"
    Company ||--o{ RFQSupplier : "receives"

    RFQ ||--o{ RFQMaterial : "requests"

    RFQ ||--o{ Quote : "generates"
    Company ||--o{ Quote : "submits"

    Quote ||--o{ QuoteItem : "contains"
    Quote ||--o{ PO : "converts_to"

    User ||--o{ Notification : "receives"
    User ||--o{ RFQ : "creates"
    User ||--o{ PO : "creates"
    User ||--o{ Session : "owns"
```
