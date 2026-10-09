# Indexed Optics: Advanced Patterns

_Compose indexed optics through nested lists so every value arrives with the full path that reached it._

~~~admonish info title="What You'll Learn"
- Compose indexed traversals with `iandThen`, and log the full index path to each value a nested update changes
- Turn zero-based positions into display numbers inside `imodify`, with no re-indexing combinator
- Narrow by position, value or both by layering `filterIndex`, `filtered` and `filteredWithIndex`
- Write an audit trail that records each changed field's name and old value with an `IndexedLens`
~~~

This page collects the advanced composition patterns and reference material that follow on from [Indexed Optics](indexed_optics.md). The narrative introduction, mental model, and step-by-step walkthrough live there; this page is for the deeper compositions and the cross-language background.

---

## Advanced Composition Patterns

### Composing Indexed Optics with Paired Indices

When you compose two indexed optics, the indices form a **pair** representing the path through nested structures.

```mermaid
flowchart TD
    accTitle: Two indexed traversals composed
    accDescr: An indexed traversal over a list of orders, composed through each order's lines lens and then with iandThen onto an indexed traversal over a list of line items, focuses each LineItem paired with a Pair of the outer index and the inner one.
    A@{ shape: st-rect, label: "IndexedTraversal&lt;Integer, List&lt;Order&gt;, Order&gt;" }
    B@{ shape: st-rect, label: "IndexedTraversal&lt;Integer,<br/>List&lt;LineItem&gt;, LineItem&gt;" }
    R["Pair&lt;Pair&lt;Integer, Integer&gt;, LineItem&gt;<br/>the outer index and the inner one,<br/>kept together"]
    A -->|"linesLens,<br/>then iandThen"| B --> R

    classDef rw fill:#a6d189,stroke:#40a02b,color:#232634
    classDef out fill:#a6d189,stroke:#40a02b,color:#232634
    class A,B rw
    class R out
```

Each item arrives carrying the whole path that reached it, outer index first:

| Path | Item |
|---|---|
| `(0, 0)` | `LAPTOP` |
| `(0, 1)` | `MOUSE` |
| `(1, 0)` | `KEYBOARD` |
| `(1, 1)` | `MONITOR` |
| `(1, 2)` | `CABLE` |

``` java
    // Nested structure: a list of orders, each with its list of lines. The orders here are two:
    // a laptop and a mouse, then a keyboard, a monitor and two cables.

    // First level: indexed traversal for orders
    IndexedTraversal<Integer, List<Order>, Order> ordersIndexed = IndexedTraversals.forList();

    // Second level: lens to the lines field
    Lens<Order, List<LineItem>> linesLens = OrderLenses.lines();

    // Third level: indexed traversal for the lines
    IndexedTraversal<Integer, List<LineItem>, LineItem> linesIndexed = IndexedTraversals.forList();

    // Compose: orders → lines field → each line with PAIRED indices
    IndexedTraversal<Pair<Integer, Integer>, List<Order>, LineItem> composed =
        ordersIndexed.andThen(linesLens.asTraversal()).iandThen(linesIndexed);

    // Access with paired indices: (order index, line index)
    List<Pair<Pair<Integer, Integer>, LineItem>> all =
        IndexedTraversals.toIndexedList(composed, orders);

    for (Pair<Pair<Integer, Integer>, LineItem> entry : all) {
      Pair<Integer, Integer> indices = entry.first();
      LineItem item = entry.second();
      System.out.printf("Order %d, Item %d: %s%n", indices.first(), indices.second(), item.sku());
    }
    // Output:
    // Order 0, Item 0: LAPTOP
    // Order 0, Item 1: MOUSE
    // Order 1, Item 0: KEYBOARD
    // Order 1, Item 1: MONITOR
    // Order 1, Item 2: CABLE
```

**Use case**: Generating globally unique identifiers like "Order 3, Item 5" or "Row 2, Column 7".

---

### Index Transformation

There is no separate re-indexing combinator; transform the index inside the `imodify` function. Converting zero-based positions to one-based display numbers looks like this:

``` java
    IndexedTraversal<Integer, List<String>, String> zeroIndexed = IndexedTraversals.forList();
    List<String> skus = items.stream().map(LineItem::sku).toList();

    List<String> numbered =
        IndexedTraversals.imodify(
            zeroIndexed,
            (zeroBasedIndex, sku) -> {
              int oneBasedIndex = zeroBasedIndex + 1;
              return "Item " + oneBasedIndex + ": " + sku;
            },
            skus);
    // The labels are "Item 1: LAPTOP", "Item 2: MOUSE" and "Item 3: KEYBOARD"
```

---

### Combining Index Filtering with Value Filtering

You can layer multiple filters for precise control.

``` java
    IndexedTraversal<Integer, List<LineItem>, LineItem> itemsIndexed = IndexedTraversals.forList();

    // Filter: even positions AND expensive items
    IndexedTraversal<Integer, List<LineItem>, LineItem> targeted =
        itemsIndexed
            .filterIndex(i -> i % 2 == 0) // Even positions only
            .filtered(item -> item.price().compareTo(new BigDecimal("50")) > 0); // Expensive only

    List<LineItem> items =
        List.of(
            new LineItem("LAPTOP", 1, new BigDecimal("999.99")), // Index 0, expensive ✓
            new LineItem("PEN", 1, new BigDecimal("2.99")), // Index 1, cheap ✗
            new LineItem("KEYBOARD", 1, new BigDecimal("79.99")), // Index 2, expensive ✓
            new LineItem("MOUSE", 1, new BigDecimal("24.99")), // Index 3, cheap ✗
            new LineItem("MONITOR", 1, new BigDecimal("299.99"))); // Index 4, expensive ✓

    List<Pair<Integer, LineItem>> results = IndexedTraversals.toIndexedList(targeted, items);
    // LAPTOP at index 0, KEYBOARD at 2 and MONITOR at 4:
    // all at even positions AND expensive
```

---

### Audit Trail Pattern: Field Change Tracking

A powerful real-world pattern is tracking *which* fields change in your domain objects. A small logger wraps a change so that it records the field's name, both values and the moment:

``` java
// Generic field audit logger
final class AuditLog {
  record FieldChange<A>(String fieldName, A oldValue, A newValue, Instant timestamp) {}

  static <A> BiFunction<String, A, A> loggedModification(
      Function<A, A> transformation, List<FieldChange<?>> auditLog) {
    return (fieldName, oldValue) -> {
      A newValue = transformation.apply(oldValue);

      if (!oldValue.equals(newValue)) {
        auditLog.add(new FieldChange<>(fieldName, oldValue, newValue, Instant.now()));
      }

      return newValue;
    };
  }

  private AuditLog() {}
}
```

An indexed lens hands the logger the field's name with each change:

``` java
    // Usage with indexed lens
    IndexedLens<String, Customer, String> nameLens =
        IndexedLens.of("name", Customer::name, (c, name) -> new Customer(name, c.email()));

    List<AuditLog.FieldChange<?>> audit = new ArrayList<>();

    Customer customer = new Customer("Ada", new EmailAddress("ada@example.com"));

    Customer updated =
        nameLens.imodify(AuditLog.loggedModification(name -> "Ada Lovelace", audit), customer);

    // Check audit log
    for (AuditLog.FieldChange<?> change : audit) {
      System.out.printf(
          "Field '%s' changed from %s to %s at %s%n",
          change.fieldName(), change.oldValue(), change.newValue(), change.timestamp());
    }
    // Output, ending with the instant the change was made, which differs on every run:
    // Field 'name' changed from Ada to Ada Lovelace at ...
```

---

### Debugging Pattern: Path Tracking in Nested Updates

When debugging complex nested updates, indexed optics reveal the complete path to each modification.

``` java
    // Nested structure with multiple levels: each history's orders, each order's lines
    record OrderHistory(List<Order> orders) {}

    // Build an indexed path through the structure
    IndexedTraversal<Integer, List<OrderHistory>, OrderHistory> historiesIdx =
        IndexedTraversals.forList();

    Lens<OrderHistory, List<Order>> ordersLens =
        Lens.of(OrderHistory::orders, (history, orders) -> new OrderHistory(orders));

    IndexedTraversal<Integer, List<Order>, Order> ordersIdx = IndexedTraversals.forList();

    Lens<Order, List<LineItem>> linesLens = OrderLenses.lines();

    IndexedTraversal<Integer, List<LineItem>, LineItem> linesIdx = IndexedTraversals.forList();

    Lens<LineItem, BigDecimal> priceLens = LineItemLenses.price();

    // Compose the full indexed path
    IndexedTraversal<Pair<Pair<Integer, Integer>, Integer>, List<OrderHistory>, BigDecimal>
        fullPath =
            historiesIdx
                .andThen(ordersLens.asTraversal())
                .iandThen(ordersIdx)
                .andThen(linesLens.asTraversal())
                .iandThen(linesIdx)
                .andThen(priceLens.asTraversal());

    // One customer, Ada, with two orders: a laptop and a mouse, then a keyboard
    List<OrderHistory> histories = List.of(new OrderHistory(adasOrders));

    // Modify with full path visibility
    List<OrderHistory> updated =
        IndexedTraversals.imodify(
            fullPath,
            (indices, price) -> {
              int customerIdx = indices.first().first();
              int orderIdx = indices.first().second();
              int itemIdx = indices.second();
              // 10% increase, rounded back to pence
              BigDecimal raised =
                  price.multiply(new BigDecimal("1.1")).setScale(2, RoundingMode.HALF_EVEN);

              System.out.printf(
                  "Updating price at [history=%d, order=%d, item=%d]: %.2f -> %.2f%n",
                  customerIdx, orderIdx, itemIdx, price, raised);

              return raised;
            },
            histories);
    // Output shows the complete path to every modified price:
    // Updating price at [history=0, order=0, item=0]: 999.99 -> 1099.99
    // Updating price at [history=0, order=0, item=1]: 24.99 -> 27.49
    // Updating price at [history=0, order=1, item=0]: 79.99 -> 87.99
```

---

### Working with Pair Utilities

The `Pair<A, B>` type provides utility methods for manipulation. Import `org.higherkindedj.optics.indexed.Pair`, the one indexed optics hand back: `org.higherkindedj.hkt.Pair` has no `withFirst`, `withSecond` or `swap`.

``` java
    Pair<Integer, String> pair = new Pair<>(1, "Hello");

    // Access components
    int first = pair.first();
    String second = pair.second();
    // first is 1, and second is "Hello"

    // Transform components
    Pair<Integer, String> modified = pair.withSecond("World");
    // Pair[first=1, second=World]

    Pair<String, String> transformed = pair.withFirst("One");
    // Pair[first=One, second=Hello]

    // Swap
    Pair<String, Integer> swapped = pair.swap();
    // Pair[first=Hello, second=1]

    // Factory method
    Pair<String, Integer> created = Pair.of("Key", 42);
```

For converting to/from `Tuple2` (when working with hkj-core utilities):

<!-- verify -->
```java
import org.higherkindedj.hkt.tuple.Tuple2;
import org.higherkindedj.optics.util.IndexedTraversals;

Pair<String, Integer> pair = Pair.of("key", 100);

// Convert to Tuple2
Tuple2<String, Integer> tuple = IndexedTraversals.pairToTuple2(pair);

// Convert back to Pair
Pair<String, Integer> converted = IndexedTraversals.tuple2ToPair(tuple);
```

---

### Real-World Example: Order Fulfilment Dashboard

Here's a comprehensive example demonstrating indexed optics in a business context.

``` java
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Currency;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.higherkindedj.example.book.optics.cast.Customer;
import org.higherkindedj.example.book.optics.cast.EmailAddress;
import org.higherkindedj.example.book.optics.cast.LineItem;
import org.higherkindedj.example.book.optics.cast.Order;
import org.higherkindedj.example.book.optics.cast.OrderLenses;
import org.higherkindedj.example.book.optics.cast.OrderStatus;
import org.higherkindedj.optics.indexed.IndexedFold;
import org.higherkindedj.optics.indexed.IndexedTraversal;
import org.higherkindedj.optics.indexed.Pair;
import org.higherkindedj.optics.util.IndexedTraversals;


public class OrderFulfilmentDashboard {

  private static Map<String, String> metadataInOrder() {
    Map<String, String> metadata = new LinkedHashMap<>();
    metadata.put("priority", "express");
    metadata.put("gift-wrap", "true");
    metadata.put("delivery-note", "Leave at door");
    return metadata;
  }

  public static void main(String[] args) {
    Order order =
        new Order(
            UUID.fromString("00000000-0000-0000-0000-000000012345"),
            new Customer("Ada", new EmailAddress("ada@example.com")),
            List.of(
                new LineItem("LAPTOP", 1, new BigDecimal("999.99")),
                new LineItem("MOUSE", 2, new BigDecimal("24.99")),
                new LineItem("KEYBOARD", 1, new BigDecimal("79.99")),
                new LineItem("MONITOR", 1, new BigDecimal("299.99"))),
            Instant.parse("2026-10-01T09:00:00Z"),
            Currency.getInstance("GBP"),
            OrderStatus.NEW);

    // The order's metadata, kept beside it. Insertion order matters for the output, so put() in
    // order: wrapping Map.of would inherit its randomised iteration order.
    Map<String, String> metadata = metadataInOrder();

    System.out.println("=== ORDER FULFILMENT DASHBOARD ===\n");

    // --- Task 1: Generate Packing Slip ---
    System.out.println("--- Packing Slip ---");
    generatePackingSlip(order);

    // --- Task 2: Apply Position-Based Discounts ---
    System.out.println("\n--- Position-Based Discounts ---");
    Order discounted = applyPositionDiscounts(order);
    System.out.printf("Original total: £%.2f%n", calculateTotal(order));
    System.out.printf("Discounted total: £%.2f%n", calculateTotal(discounted));

    // --- Task 3: Process Metadata with Key Awareness ---
    System.out.println("\n--- Metadata Processing ---");
    processMetadata(metadata);

    // --- Task 4: Identify High-Value Positions ---
    System.out.println("\n--- High-Value Items ---");
    identifyHighValuePositions(order);

    System.out.println("\n=== END OF DASHBOARD ===");
  }

  private static void generatePackingSlip(Order order) {
    IndexedTraversal<Integer, List<LineItem>, LineItem> itemsIndexed = IndexedTraversals.forList();

    List<Pair<Integer, LineItem>> indexedItems =
        IndexedTraversals.toIndexedList(itemsIndexed, order.lines());

    System.out.println("Order: " + order.id());
    for (Pair<Integer, LineItem> pair : indexedItems) {
      int position = pair.first() + 1; // 1-based for display
      LineItem item = pair.second();
      System.out.printf(
          "  Item %d: %s (Qty: %d) - £%.2f%n",
          position, item.sku(), item.quantity(), lineTotal(item));
    }
  }

  private static Order applyPositionDiscounts(Order order) {
    IndexedTraversal<Integer, List<LineItem>, LineItem> itemsIndexed = IndexedTraversals.forList();

    // Every 3rd item gets 15% off (indices 2, 5, 8...)
    List<LineItem> discounted =
        IndexedTraversals.imodify(
            itemsIndexed,
            (index, item) -> {
              if ((index + 1) % 3 == 0) {
                BigDecimal newPrice =
                    item.price()
                        .multiply(new BigDecimal("0.85"))
                        .setScale(2, RoundingMode.HALF_EVEN);
                System.out.printf(
                    "  Position %d (%s): £%.2f → £%.2f (15%% off)%n",
                    index + 1, item.sku(), item.price(), newPrice);
                return new LineItem(item.sku(), item.quantity(), newPrice);
              }
              return item;
            },
            order.lines());

    return OrderLenses.lines().set(discounted, order);
  }

  private static void processMetadata(Map<String, String> metadata) {
    IndexedTraversal<String, Map<String, String>, String> metadataIndexed =
        IndexedTraversals.forMap();

    IndexedFold<String, Map<String, String>, String> fold = metadataIndexed.asIndexedFold();

    List<Pair<String, String>> entries = fold.toIndexedList(metadata);

    for (Pair<String, String> entry : entries) {
      String key = entry.first();
      String value = entry.second();

      // Process based on key
      switch (key) {
        case "priority" -> System.out.println("  Shipping priority: " + value.toUpperCase());
        case "gift-wrap" ->
            System.out.println(
                "  Gift wrapping: " + (value.equals("true") ? "Required" : "Not required"));
        case "delivery-note" -> System.out.println("  Special instructions: " + value);
        default -> System.out.println("  " + key + ": " + value);
      }
    }
  }

  private static void identifyHighValuePositions(Order order) {
    IndexedTraversal<Integer, List<LineItem>, LineItem> itemsIndexed = IndexedTraversals.forList();

    // Filter to items over £100
    IndexedTraversal<Integer, List<LineItem>, LineItem> highValue =
        itemsIndexed.filteredWithIndex(
            (index, item) -> item.price().compareTo(new BigDecimal("100")) > 0);

    List<Pair<Integer, LineItem>> expensive =
        IndexedTraversals.toIndexedList(highValue, order.lines());

    System.out.println("  Items over £100 (require special handling):");
    for (Pair<Integer, LineItem> pair : expensive) {
      System.out.printf(
          "    Position %d: %s (£%.2f)%n",
          pair.first() + 1, pair.second().sku(), pair.second().price());
    }
  }

  private static BigDecimal lineTotal(LineItem item) {
    return item.price().multiply(BigDecimal.valueOf(item.quantity()));
  }

  private static BigDecimal calculateTotal(Order order) {
    return order.lines().stream()
        .map(OrderFulfilmentDashboard::lineTotal)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }
}
```

**Expected Output:**

```
=== ORDER FULFILMENT DASHBOARD ===

--- Packing Slip ---
Order: 00000000-0000-0000-0000-000000012345
  Item 1: LAPTOP (Qty: 1) - £999.99
  Item 2: MOUSE (Qty: 2) - £49.98
  Item 3: KEYBOARD (Qty: 1) - £79.99
  Item 4: MONITOR (Qty: 1) - £299.99

--- Position-Based Discounts ---
  Position 3 (KEYBOARD): £79.99 → £67.99 (15% off)
Original total: £1429.95
Discounted total: £1417.95

--- Metadata Processing ---
  Shipping priority: EXPRESS
  Gift wrapping: Required
  Special instructions: Leave at door

--- High-Value Items ---
  Items over £100 (require special handling):
    Position 1: LAPTOP (£999.99)
    Position 4: MONITOR (£299.99)

=== END OF DASHBOARD ===
```

---

## The Relationship to Haskell's Lens Library

For those familiar with functional programming, Higher-Kinded-J's indexed optics are inspired by Haskell's [lens library](https://hackage.haskell.org/package/lens), specifically indexed traversals and indexed folds.

In Haskell:
```haskell
itraversed :: IndexedTraversal Int ([] a) a
```

This creates an indexed traversal over lists where the index is an integer: exactly what our `IndexedTraversals.forList()` provides.

**Key differences:**
- Higher-Kinded-J uses explicit `Applicative` instances rather than implicit type class resolution
- Java's type system requires explicit `Pair<I, A>` for index-value pairs
- The `imodify` and `iget` methods provide a more Java-friendly API
- Map-based traversals (`forMap`) are a practical extension for Java's collection library

---

## Before and after {#summary-the-power-of-indexed-optics}

What each manual pattern becomes with indexed optics:

| Before (Manual Index Tracking) | After (Declarative Indexed Optics) |
|-------------------------------|-----------------------------------|
| Manual loop counters | Built-in index access |
| AtomicInteger for streams | Type-safe `imodify` |
| Breaking into Map.entrySet() | Direct key-value processing |
| Complex audit logging logic | Field tracking with `IndexedLens` |
| Scattered position logic | Composable indexed transformations |

~~~admonish info title="Key Takeaways"
* **`iandThen` pairs the indices**: composing indexed traversals yields `Pair<I, J>` paths, so "history 0, order 1, item 2" is a value, not a log line
* **Transform indices inside `imodify`**: there is no separate re-indexing combinator, and none is needed
* **Layered filters compose**: `filterIndex` for position, `filtered` for value, `filteredWithIndex` for both at once
* **`IndexedLens` powers audit trails**: the field name arrives with the old value, so change logging needs no reflection
* **`Pair` is a first-class utility**: `withFirst`/`withSecond`/`swap`, plus `pairToTuple2`/`tuple2ToPair` to bridge into hkj-core
~~~

~~~admonish tip title="See Also"
- [Indexed Optics](indexed_optics.md): the basics this page builds on
- [Position-Aware Traversals with ForIndexed](../functional/for_optics.md#position-aware-traversals-with-forindexed): comprehension-style position-aware filtering, modifying, and collecting
- [Indexed Access](indexed_access.md): At and Ixed for single-key operations
~~~

~~~admonish tip title="Further Reading"
- **Haskell**: [Lens Tutorial: Indexed Optics](https://hackage.haskell.org/package/lens-tutorial-1.0.4/docs/Control-Lens-Tutorial.html): original inspiration
- **Chris Penner**: [Optics By Example](https://leanpub.com/optics-by-example): chapter on indexed optics
- **Scala**: [Monocle](https://www.optics.dev/Monocle/): similar indexed optics for Scala
~~~

---

**Previous:** [Indexed Optics](indexed_optics.md)
**Next:** [Each Type Class](each_typeclass.md)
