# Capstone: One 422, Every Bad Field

> _"Make illegal states unrepresentable."_
> — Yaron Minsky

~~~admonish info title="What You'll Learn"
- One order-intake boundary built end to end: codecs, a custom leaf, a rename, nesting, a list, and a derived field
- The payoff: a five-defect request answered by a single response naming every bad field by path
- A preview of three later pages on the same boundary: a sparse PATCH, a multi-source merge, and a typed error envelope
- The laws test that proves all of it, copied from a green build
~~~

~~~admonish example title="See Example Code"
**The code on this page is [BoundaryCapstoneBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/mapping/capstone/BoundaryCapstoneBook.java)** and its **[BoundaryCapstoneBookLawsTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/mapping/capstone/BoundaryCapstoneBookLawsTest.java)** - the page includes both directly, so every Java block on this page is compiled, run, and asserted by the build.
~~~

---

## The Scenario

An order-intake API. The domain is what the business logic trusts: typed identifiers, a real `Instant`, a real `Currency`, an email that has already been checked.

``` java
enum OrderStatus {
  NEW,
  PAID,
  SHIPPED
}

record EmailAddress(String value) {}

record Customer(String name, EmailAddress email) {}

// Integer, not int: a leaf converts the quantity, and a leaf cannot name a primitive.
record LineItem(String sku, Integer quantity, BigDecimal price) {}

record Order(
    UUID id,
    Customer customer,
    List<LineItem> lines,
    Instant placedAt,
    Currency currency,
    OrderStatus status) {}

```

The wire is what clients actually send: strings, a rename (`fullName`), and one field the domain does not store because it can be computed:

``` java
record CustomerDto(String fullName, String email) {}

record LineItemDto(String sku, String quantity, String price) {}

record OrderDto(
    String id,
    CustomerDto customer,
    List<LineItemDto> lines,
    String placedAt,
    String currency,
    String status,
    String displayTotal) {} // no domain counterpart: derived on build, ignored on parse

```

Every value a leaf converts arrives as a `String`, the quantity included, so `parse` can locate a bad one. A client can still send the quantity as a JSON number, which Jackson binds as its digits. [Standard codecs](codecs.md#standard-codecs) weighs this against an `Integer` wire field, where a malformed quantity fails inside Jackson and `2.5` quietly becomes `2`.

**The task:** accept an `OrderDto`, return a trusted `Order`, and when the request is bad, tell the client *everything* that is wrong with it, in one round trip, with every problem located.

---

## The Imperative Approach

The [chapter opened](ch_intro.md) with a sketch of this mapper; here it is at full scale:

``` java
  /** The hand-written version this chapter replaces: throws on the first problem, unlocated. */
  static Order toDomainByHand(OrderDto dto) {
    Objects.requireNonNull(dto.customer(), "customer required"); // first null wins
    if (!dto.customer().email().contains("@")) {
      throw new IllegalArgumentException("bad email"); // no field name, no path
    }
    List<LineItem> lines = new ArrayList<>();
    for (LineItemDto line : dto.lines()) {
      lines.add(
          new LineItem(
              line.sku(), Integer.parseInt(line.quantity()), new BigDecimal(line.price())));
    }
    return new Order(
        UUID.fromString(dto.id()), // throws its own exception
        new Customer(dto.customer().fullName(), new EmailAddress(dto.customer().email())),
        List.copyOf(lines),
        Instant.parse(dto.placedAt()), // and so does this one
        Currency.getInstance(dto.currency()), // and this one
        OrderStatus.valueOf(dto.status())); // and this one
  }

```

Count the ways [the five-defect request](#the-payoff) defeats it. The mapper reports **one** problem, whichever throws first, and its message carries **no field path**. Eight call sites throw four different exception types (`NullPointerException`, `IllegalArgumentException`, `DateTimeParseException`, `NumberFormatException`). Since a `NumberFormatException` is an `IllegalArgumentException`, three unrelated catch clauses cover them. And when `Order` grows a component next quarter, nothing warns that this method no longer covers it.

---

## The HKJ Approach

One hand-written leaf for the email (everything else is stock), shared through a vocabulary interface:

``` java
/** The one hand-written leaf; everything else comes from StandardCodecs. */
final class Codecs {
  static final ValidatedPrism<String, EmailAddress> EMAIL =
      ValidatedPrism.of(
          raw ->
              raw.contains("@")
                  ? Validated.validNel(new EmailAddress(raw))
                  : Validated.invalidNel(FieldError.of("not an email address")),
          EmailAddress::value);

  private Codecs() {}
}

/** Shared vocabulary: the same email leaf serves the full mapping and its PATCH sibling. */
interface OrderVocabulary {
  default ValidatedPrism<String, EmailAddress> email() {
    return Codecs.EMAIL;
  }
}

```

Three specs declare the whole boundary. Every conversion is named after its component; the processor derives both directions and rejects anything it cannot honour:

``` java
@GenerateMapping
interface CustomerMapping extends OrderVocabulary, MappingSpec<Customer, CustomerDto> {
  @MapField(to = "fullName")
  String name(); // the wire spells it differently
}

@GenerateMapping
interface LineItemMapping extends MappingSpec<LineItem, LineItemDto> {
  default ValidatedPrism<String, Integer> quantity() {
    return intFromString();
  }

  default ValidatedPrism<String, BigDecimal> price() {
    return bigDecimal();
  }
}

@GenerateMapping
interface OrderMapping extends MappingSpec<Order, OrderDto> {
  default ValidatedPrism<String, UUID> id() {
    return uuid();
  }

  default ValidatedPrism<String, Instant> placedAt() {
    return instant();
  }

  default ValidatedPrism<String, Currency> currency() {
    return StandardCodecs.currency(); // qualified: the leaf shares the factory's name
  }

  default ValidatedPrism<String, OrderStatus> status() {
    return enumByName(OrderStatus.class);
  }

  // A wire-only component, computed from the whole domain value on build:
  default Getter<Order, String> displayTotal() {
    return Getter.of(
        order ->
            order.currency().getCurrencyCode()
                + " "
                + order.lines().stream()
                    .map(line -> line.price().multiply(BigDecimal.valueOf(line.quantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
  }
}

```

That is the entire declaration: no mapper class, no Bean Validation annotations, no exception handler. It is not *shorter* than the hand-written mapper: three small interfaces, a vocabulary, and one custom leaf, against a nineteen-line method. What changed is what each line does, since these lines also carry the validation, the locations, the reverse direction, and the laws. `build` is total, and the derived `displayTotal` is computed, not copied:

``` java
    Order order =
        new Order(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000"),
            new Customer("Ada Lovelace", new EmailAddress("ada@corp.example")),
            List.of(new LineItem("SKU-1", 2, new BigDecimal("9.99"))),
            Instant.parse("2026-07-28T12:34:56Z"),
            Currency.getInstance("GBP"),
            OrderStatus.PAID);

    OrderDto outbound = OrderMappingImpl.INSTANCE.build(order); // total: cannot fail
    // OrderDto[id=123e4567-..., customer=CustomerDto[fullName=Ada Lovelace, ...],
    //          placedAt=2026-07-28T12:34:56Z, currency=GBP, status=PAID,
    //          displayTotal=GBP 19.98]   <- computed by the derived getter
```

---

## The Payoff

Now the five-defect request, with a prediction first.

~~~admonish question title="Checkpoint: count the errors first" id="check-capstone-count"
The `hostile` request has a bad id, a bad email inside the nested customer, and a bad price on the second line item. Its timestamp is in a format the codec does not speak, its status is unknown, and its `displayTotal` is `null`.

Before you read the result: how many located errors does `parse` report, and is the `null` one of them?
~~~

~~~admonish success title="Answer and why" collapsible=true id="check-capstone-count-answer"
**Five, and the `null` is not among them.** `displayTotal` is a derived field: `build` computes it from the whole domain value and `parse` never reads it, so the null guard, which covers every value `parse` does read, has nothing to guard here. [The Proof](#the-proof) asserts the five, in order.

Where this lives: [Derived wire fields](basics.md#derived-wire-fields).
~~~

``` java
    OrderDto hostile =
        new OrderDto(
            "NOPE", // not a UUID
            new CustomerDto("Ada Lovelace", "not-an-email"), // fails the email leaf
            List.of(new LineItemDto("SKU-1", "2", "9.99"), new LineItemDto("SKU-2", "1", "1E+3")),
            "28/07/2026", // not an ISO-8601 instant
            "GBP",
            "DISPATCHED", // not a permitted OrderStatus
            null); // derived: parse ignores it

    Validated<NonEmptyList<FieldError>, Order> parsed = OrderMappingImpl.INSTANCE.parse(hostile);
    // Invalid(NonEmptyList[
    //   id: not a UUID (expected e.g. 123e4567-e89b-12d3-a456-426614174000),
    //   customer.email: not an email address,
    //   lines.1.price: not a number in plain notation (expected e.g. 123.45),
    //   placedAt: not an ISO-8601 instant (expected e.g. 2026-07-28T12:34:56Z),
    //   status: unknown OrderStatus (expected one of NEW, PAID, SHIPPED)])
```

Five defects, one value, every error located, in declaration order. In a Spring controller this result needs no wrapping: return it as-is and [the 422 leg](../spring/spring_boot_integration.md#the-422-leg) renders it as one response, the very response [the chapter's introduction](ch_intro.md) promised:

```json
{
  "valid": false,
  "errors": [
    { "path": "id",             "segments": ["id"],                    "message": "not a UUID (expected e.g. 123e4567-e89b-12d3-a456-426614174000)" },
    { "path": "customer.email", "segments": ["customer", "email"],     "message": "not an email address" },
    { "path": "lines.1.price",  "segments": ["lines", "1", "price"],   "message": "not a number in plain notation (expected e.g. 123.45)" },
    { "path": "placedAt",       "segments": ["placedAt"],              "message": "not an ISO-8601 instant (expected e.g. 2026-07-28T12:34:56Z)" },
    { "path": "status",         "segments": ["status"],                "message": "unknown OrderStatus (expected one of NEW, PAID, SHIPPED)" }
  ],
  "errorCount": 5
}
```

The client fixes all five and resubmits once, where the hand-written mapper would have surfaced them one 400 at a time. A Bean Validation stack accumulates better than that, but its errors describe the *DTO*. The five here describe the domain's components, by their domain names even where the wire renames one ([Renames](basics.md#renames-mapfield)). They come from the same declarations that produce the `Order`, and that parse is the only way from the wire into the domain.

### What happened, error by error

| Located error | Machinery that produced it |
|---|---|
| `id: not a UUID (...)` | the stock [`uuid()` codec](codecs.md#standard-codecs) |
| `customer.email: not an email address` | the hand-written leaf, located **through the [nested spec](structure.md#nesting-containers-and-recursion)** |
| `lines.1.price: not a number in plain notation (...)` | `bigDecimal()`, which accepts [canonical forms only](codecs.md#canonical-forms-only), in the spec the list [lifts](structure.md#nesting-containers-and-recursion), located **by element index** |
| `placedAt: not an ISO-8601 instant (...)` | [`instant()`](codecs.md#canonical-forms-only), rejecting a format it does not speak |
| `status: unknown OrderStatus (...)` | [`enumByName(...)`](codecs.md#standard-codecs), naming the permitted constants |

Each error came from a page before this one, and no error-handling code was written to produce any of them.

---

## The Encores

The same boundary, two more mappings in a handful of lines, and a third generator described in a paragraph. Each previews a later page and links to it.

**A sparse PATCH.** The email leaf is already in the vocabulary, so the PATCH sibling is one bean and one empty spec ([Sparse PATCH](beans_patch.md) covers it in full). Absent means keep; a present bad value still fails, located:

``` java
/** The PATCH request bean: a null property means "not provided, leave unchanged". */
class CustomerPatchBean {
  private String name;
  private String email;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }
}

@GenerateMapping
interface CustomerPatchMapping extends OrderVocabulary, UpdateSpec<Customer, CustomerPatchBean> {}

```

``` java
    Customer current = new Customer("Ada Lovelace", new EmailAddress("ada@corp.example"));

    CustomerPatchBean patchBody = new CustomerPatchBean();
    patchBody.setEmail("countess@lovelace.example"); // name omitted: null, keep the current one

    Validated<NonEmptyList<FieldError>, Customer> patched =
        CustomerPatchMappingImpl.INSTANCE.updateFrom(patchBody).apply(current);
    // Valid(Customer[name=Ada Lovelace, email=EmailAddress[value=countess@lovelace.example]])
```

**A receipt, merged.** One target from two sources, filled by component name, no class literals, by [`@GenerateMerge`](merge_envelopes.md#merging-several-sources-generatemerge):

``` java
record Receipt(UUID id, String name, EmailAddress email, Instant placedAt) {}

@GenerateMerge
interface ReceiptAssembly {
  Receipt assemble(Order order, Customer customer);
}

```

``` java
    Receipt receipt = ReceiptAssemblyImpl.INSTANCE.assemble(order, order.customer());
    // Receipt[id=123e4567-..., name=Ada Lovelace, email=..., placedAt=2026-07-28T12:34:56Z]
```

**A typed error envelope.** When the service behind a boundary like this fails, its sealed error hierarchy tends to re-declare `code`/`message`/`timestamp`/`context` on every variant, with `context` an untyped `Map<String, Object>`. [`@GenerateErrorEnvelope`](merge_envelopes.md#generating-error-envelopes-generateerrorenvelope) generates that envelope and types the context; its running example is an order-domain `OrderError`, worked in full on the [Merge and Error Envelopes](merge_envelopes.md) page.

---

## The Proof

"Lawful" is a passing test, not an adjective. First, a test asserts [the payoff](#the-payoff) message for message, in order. The five-defect wire must produce exactly those five located errors:

``` java
    OrderDto hostile =
        new OrderDto(
            "NOPE",
            new CustomerDto("Ada Lovelace", "not-an-email"),
            List.of(new LineItemDto("SKU-1", "2", "9.99"), new LineItemDto("SKU-2", "1", "1E+3")),
            "28/07/2026",
            "GBP",
            "DISPATCHED",
            null);

    Validated<NonEmptyList<FieldError>, Order> parsed = OrderMappingImpl.INSTANCE.parse(hostile);

    assertThatValidated(parsed)
        .isInvalid()
        .hasFieldErrors(
            "id: not a UUID (expected e.g. 123e4567-e89b-12d3-a456-426614174000)",
            "customer.email: not an email address",
            "lines.1.price: not a number in plain notation (expected e.g. 123.45)",
            "placedAt: not an ISO-8601 instant (expected e.g. 2026-07-28T12:34:56Z)",
            "status: unknown OrderStatus (expected one of NEW, PAID, SHIPPED)");
```

Second, the full mapping obeys the [fallible tier's laws](tiers.md#law-checked-in-the-repo-and-in-your-tests) (round trip on a parsing wire, guaranteed rejection on a non-parsing one, coherence with `build`), through the same `MappingLaws` harness the library's own build runs:

``` java
    // Fallible tier: a wire that parses (its derived displayTotal matching what build
    // would produce, keeping the no-parse check honest), and a wire that must not.
    MappingLaws.assertMappingLaws(
        OrderMappingImpl.INSTANCE.asValidatedPrism(),
        new OrderDto(
            "123e4567-e89b-12d3-a456-426614174000",
            new CustomerDto("Ada Lovelace", "ada@corp.example"),
            List.of(new LineItemDto("SKU-1", "2", "9.99")),
            "2026-07-28T12:34:56Z",
            "GBP",
            "PAID",
            "GBP 19.98"),
        new OrderDto(
            "NOPE",
            new CustomerDto("Ada Lovelace", "ada@corp.example"),
            List.of(),
            "2026-07-28T12:34:56Z",
            "GBP",
            "PAID",
            null));
```

Third, the PATCH sibling obeys the sparse laws: an all-absent form is the identity update, a valid present field changes the domain, an invalid one fails located:

``` java
    MappingLaws.assertMappingLaws(
        CustomerPatchMappingImpl.INSTANCE::updateFrom,
        new Customer("Ada Lovelace", new EmailAddress("ada@corp.example")), // the current value
        new CustomerPatchBean(), // all-absent, as bound from {} -> identity
        patch(null, "countess@lovelace.example"), // present valid -> changes the domain
        patch(null, "not-an-email")); // present invalid -> located failure
```

---

~~~admonish info title="Key Takeaways"
* **The whole boundary is three small interfaces**: one custom leaf, stock codecs for the rest, a rename, a derived field; the processor derives both directions and keeps them covering the records
* **One response, every bad field**: nesting, list indices, and codec messages compose into located errors a client can map straight onto its form
* **The encores are almost free**: the PATCH sibling reuses the vocabulary, the merge is a method signature, the envelope is one component
* **All of it is proven**: the page's payoff and laws are includes from a green test
~~~

~~~admonish tip title="See Also"
- [The 422 leg](../spring/spring_boot_integration.md#the-422-leg): This result as an HTTP response, unmodified
- [Sparse PATCH at the Spring boundary](../spring/spring_boot_integration.md#sparse-patch): The PATCH encore behind a controller
- [What Your Spec Generates](tiers.md): Which methods each spec shape gets, and the laws The Proof checks
- [Capstone: Effects Meet Optics](../effect/capstone_focus_effect.md): The effect-side sibling capstone
~~~

---

**Previous:** [Nesting, Containers, and Sealed Hierarchies](structure.md)
**Next:** [Check Your Understanding](self_check.md)
