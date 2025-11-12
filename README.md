# FlowBuilder Website Page Map & Tech Overview

## 1) Project Overview

**FlowBuilder** is a smart‑procurement SaaS for construction that replaces fragmented, manual workflows with a centralized, intelligent hub so general contractors can make faster, more cost‑effective decisions. Its core differentiator is an **AI‑assisted RFQ engine** that analyzes project requirements and recommends suppliers based on trade specialty and historical performance.

The platform’s value proposition spans three pillars: a **Centralized Management Hub** (company/users, projects, unified supplier & material databases), an **Intelligent Procurement Module** (AI‑assisted RFQ, quote comparison, one‑click PO), and **Essential Delivery Oversight** (PO status tracking and notifications).

For the **MVP**, FlowBuilder delivers a complete end‑to‑end procurement workflow using one primary persona (Construction Admin), with **pre‑defined suppliers/materials** to reduce setup complexity, while keeping the AI recommendation engine in scope.

---

## 2) Page Map

### Flowchart

```mermaid
graph TD

%% Phase 1 / MVP
A[Sign In]:::high --> B(Dashboard)
B --> C(Projects)

C --> C1(Project Detail)
C --> C2(Manage RFQ)
C --> C3(Manage Quote)

C2 --> C21(Create RFQ)
C2 --> C22(Distribute RFQ)

C3 --> C31(Submit Quote)
C3 --> C32(Compare Quote)
C3 --> C33(Generate PO)

C --> D(PO Tracker)


%% Phase 2 / Enhancements
B --> M(Suppliers Directory)
B --> N(Material Catalog)
B --> O(Company & Users Management)


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


