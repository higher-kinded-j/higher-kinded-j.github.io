<!-- description: Combine values with Semigroup, start from a Monoid's empty value, total money exactly with bigDecimalAddition, and build your own monoid with Monoid.of. -->

# Semigroup and Monoid: Foundational Type Classes

_Combine two values of one type, and start from an empty value to total any number of them._

~~~admonish info title="What You'll Learn"
- Combine two values of one type with a `Semigroup`, and say what associativity promises
- Start a combination from a `Monoid`'s empty value, so an empty list totals to zero
- Total money exactly with `Monoids.bigDecimalAddition()`, and build a monoid the library lacks with `Monoid.of`
- Pick a ready-made monoid for numbers, strings, collections, optional values and updates
- Check a monoid against its three laws
~~~

~~~admonish example title="See Example Code"
**The code on this page is [MonoidBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/monoid/MonoidBook.java)**: the page includes it, so the build compiles and runs it. [MonoidBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/monoid/MonoidBookTest.java) holds what the page says, and [FoundationsLawsBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/FoundationsLawsBookTest.java) checks the laws.
~~~

---

## Combining two values {#combining-two-values}

A `Semigroup<A>` has one method, `combine`, which takes two values of type `A` and returns one. Unlike the type classes on the pages around this one, it works on plain values, not on a container `Kind<F, A>`: two lists of errors become one list, and two strings become one string.

The code on this page uses these imports, with `LineItem` from the order records the [Optics](../optics/ch_intro.md) chapter introduces:

<!-- verify -->
```java
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.higherkindedj.example.book.optics.cast.LineItem;
import org.higherkindedj.hkt.Monoid;
import org.higherkindedj.hkt.Monoids;
import org.higherkindedj.hkt.Semigroup;
import org.higherkindedj.hkt.Semigroups;
import org.higherkindedj.hkt.Update;
```

```java
    Semigroup<List<String>> errors = Semigroups.list();
    List<String> both =
        errors.combine(List.of("SKU is blank"), List.of("quantity must be positive"));
    // [SKU is blank, quantity must be positive]

    Semigroup<String> joined = Semigroups.string("; ");
    String message = joined.combine("SKU is blank", "quantity must be positive");
    // the message reads "SKU is blank; quantity must be positive"
```

`combine` must be associative: `combine(combine(a, b), c)` equals `combine(a, combine(b, c))`. So a list of values combines to the same result however you group the calls, and a library can split a long list and combine the halves.

The `Semigroups` interface holds the common ones:

| Factory | Combines two values by |
|---|---|
| `Semigroups.list()` | Joining two lists, the first's elements first |
| `Semigroups.set()` | Taking the union of two sets |
| `Semigroups.string()` | Joining two strings |
| `Semigroups.string(delimiter)` | Joining two strings with `delimiter` between them |
| `Semigroups.first()` | Keeping the first value |
| `Semigroups.last()` | Keeping the last value |

The library's main use for one is [`Validated`](../monads/validated_monad.md)'s error accumulation. `Instances.validated(Semigroups.list())` gives an `Applicative` whose `map2` joins the errors of every invalid input with the semigroup, as [Applicative](applicative.md#what-each-instance-does) shows.

~~~admonish tip title="The non-empty alternative: `NonEmptyList.semigroup()`"
For errors, a [`NonEmptyList`](../monads/nonemptylist_monad.md) says in its type what an invalid result promises: at least one error, so its `head` and `reduce` need no empty case. `NonEmptyList.semigroup()` joins two of them, left to right. It lives on the type rather than in `Semigroups`, because `NonEmptyList` is in `hkj-core` and `Semigroups` in `hkj-api`. `Path.validNel` and `Path.invalidNel` build it in, so the common validation needs no `Semigroup` argument.
~~~

---

## Starting from an empty value {#starting-from-an-empty-value}

A `Monoid<A>` is a `Semigroup<A>` with one more method, `empty`, which returns a value that changes nothing when combined with another. Zero is addition's empty value, and an empty list is joining's. With it, `combineAll`, a default method on every `Monoid`, can total any number of values, none included, since a total of nothing is the empty value.

If you have called `stream.reduce(identity, accumulator)`, you have used a monoid: `reduce` asks for an identity and an associative accumulator, and `Monoid` names that pair.

The examples total an order's lines:

```java
  /** An order's lines: one lamp at 40.00, and four bulbs at 2.50 each. */
  public static final List<LineItem> LINES =
      List.of(
          new LineItem("LAMP", 1, new BigDecimal("40.00")),
          new LineItem("BULB", 4, new BigDecimal("2.50")));

  /** A later order's lines: three more bulbs. */
  public static final List<LineItem> REFILL =
      List.of(new LineItem("BULB", 3, new BigDecimal("2.50")));

  /** What a line costs: its price times its quantity. */
  public static BigDecimal lineTotal(LineItem line) {
    return line.price().multiply(BigDecimal.valueOf(line.quantity()));
  }

```

An order's total is the monoid for `BigDecimal` addition, run over each line's total:

```java
    Monoid<BigDecimal> money = Monoids.bigDecimalAddition();
    BigDecimal total = money.combineAll(LINES.stream().map(MonoidBook::lineTotal).toList());
    // 50.00

    BigDecimal noLines = money.combineAll(List.of());
    // 0
```

On an [Effect Path](../effect/ch_intro.md), `ListPath.foldMap` takes the monoid and the function together, and [Foldable and Traverse](foldable_and_traverse.md#foldable-one-structure-many-summaries) does the same for any container.

Money is `BigDecimal`, as `LineItem.price` is, since `Monoids.doubleAddition()` rounds, as [Things people get wrong](#things-people-get-wrong) shows. A `BigDecimal` sum keeps the larger scale of its two values, so prices with two decimal places total to a value with two.

### Ready-made monoids {#ready-made-monoids}

| Factory | Combines by | Empty value |
|---|---|---|
| `integerAddition()`, `longAddition()` | `+` | `0` |
| `integerMultiplication()`, `longMultiplication()` | `*` | `1` |
| `doubleAddition()`, `doubleMultiplication()` | `+`, `*`, which round, so regrouping can change the result, as [Things people get wrong](#things-people-get-wrong) shows | `0.0`, `1.0` |
| `bigDecimalAddition()` | `BigDecimal.add` | `BigDecimal.ZERO` |
| `booleanAnd()`, `booleanOr()` | `&&`, `\|\|` | `true`, `false` |
| `string()` | Joining two strings | `""` |
| `list()`, `set()` | Joining two lists, or the union of two sets | An empty list, or an empty set |
| `firstOptional()`, `lastOptional()` | Keeping the first, or the last, present value | `Optional.empty()` |
| `maximum()`, `minimum()`, with or without a `Comparator` | Keeping the greater, or the lesser, present value | `Optional.empty()` |
| `update()` | Applying one `Update` and then the other | `Update.identity()` |

Each is a static method on `Monoids`, such as `Monoids.list()`.

### A monoid of your own {#a-monoid-of-your-own}

`Monoid.of(empty, combine)` builds one from its empty value and a `Semigroup`, which can be a lambda. Counting the units of each SKU across orders needs a monoid `Monoids` does not have: an empty map, and a merge that adds the counts.

```java
  // Units per SKU, which no Monoids factory gives: an empty map, and a merge adding the counts
  public static final Monoid<Map<String, Integer>> UNITS =
      Monoid.of(
          Map.of(),
          (left, right) -> {
            Map<String, Integer> sum = new TreeMap<>(left);
            right.forEach((sku, units) -> sum.merge(sku, units, Integer::sum));
            return Collections.unmodifiableMap(sum);
          });

  static Map<String, Integer> units(List<LineItem> lines) {
    return UNITS.combineAll(
        lines.stream().map(line -> Map.of(line.sku(), line.quantity())).toList());
  }

```

```java
    Map<String, Integer> stock = UNITS.combine(units(LINES), units(REFILL));
    // a map of BULB to 7 and LAMP to 1
```

`Monoid.of` does not check the laws, so check them as [Three laws](#three-laws) does.

---

## What every monoid can do {#what-every-monoid-can-do}

Besides `combineAll`, every `Monoid` has two more default methods. `combineN(value, n)` combines a value with itself `n` times: `n` of `0` gives the empty value, and a negative `n` throws `IllegalArgumentException`. `isEmpty` tests whether a value is the empty value.

```java
    BigDecimal sixLamps = money.combineN(new BigDecimal("40.00"), 6);
    // 240.00

    boolean nothingOwed = money.isEmpty(new BigDecimal("0.00"));
    // true
```

---

## Choosing among optional values {#choosing-among-optional-values}

The optional monoids pick one present value from many. `firstOptional` and `lastOptional` pick by position and compare nothing, so `firstOptional` suits a fallback chain: a setting from the environment, then one from a file, then a default. `maximum` and `minimum` compare the values, by the `Comparator` you pass or by the type's natural order.

```java
    Monoid<Optional<LineItem>> priciest = Monoids.maximum(Comparator.comparing(LineItem::price));
    Optional<LineItem> dearest = priciest.combineAll(LINES.stream().map(Optional::of).toList());
    // Optional[LineItem[sku=LAMP, quantity=1, price=40.00]]

    Optional<LineItem> none = priciest.combineAll(List.of());
    // an empty Optional, the monoid's empty value
```

Each skips an empty `Optional`, and a list of only empty ones, or of none, gives `Optional.empty()`.

---

## Composing updates {#composing-updates}

Every monoid so far combines data. `Monoids.update()` combines behaviour. An `Update<S>` is a transformation from an `S` to a new `S`. It extends `UnaryOperator<S>`, so it goes wherever Java takes a `Function<S, S>`, such as `Stream.map`, and its `andThen` returns an `Update`, so a chain of them stays one. The monoid's `combine(f, g)` applies `f` and then `g`, and its empty value is `Update.identity()`, which returns its input unchanged.

```java
    Update<LineItem> restock = line -> new LineItem(line.sku(), line.quantity() + 10, line.price());
    Update<LineItem> markDown =
        line ->
            new LineItem(
                line.sku(), line.quantity(), line.price().subtract(new BigDecimal("5.00")));

    Monoid<Update<LineItem>> steps = Monoids.update();
    Update<LineItem> restockThenMarkDown = steps.combineAll(List.of(restock, markDown));
    LineItem lamp = restockThenMarkDown.apply(LINES.getFirst());
    // LineItem[sku=LAMP, quantity=11, price=35.00]
```

A step with nothing to change can be `Update.identity()`. That is what makes sparse updates work: the [`Edits` builder](../optics/multi_edit.md) folds optic edits through `Monoids.update()`, and a field the request left out contributes `Update.identity()`. Fold updates with `combineAll`, which applies them in a loop. A fold through `combine`, such as `foldMap`, nests one call per update, and a long enough list overflows the stack.

~~~admonish note title="For the functionally curious"
In functional programming this is the `Endo` monoid, for *endomorphism*, a function from a type to itself. Higher-Kinded-J names it `Update` for clarity.
~~~

---

## Three laws {#three-laws}

A `Semigroup` keeps one law and a `Monoid` two more. Together they say that grouping does not matter, and that the empty value adds nothing.

~~~admonish note title="Laws"
- **Associativity: grouping the combines differently changes nothing.** `combine(combine(a, b), c)` equals `combine(a, combine(b, c))`.
- **Left identity: combining the empty value first changes nothing.** `combine(empty(), a)` equals `a`.
- **Right identity: combining the empty value last changes nothing.** `combine(a, empty())` equals `a`.

Values are equal by `equals`. For `bigDecimalAddition`, the identity laws hold by `equals` for a value of scale zero or more, which includes any price. Added to `ZERO`, `new BigDecimal("1E+3")` comes back as `1000`: equal by `compareTo`, but not by `equals`.

Checking the `Semigroup` and `Monoid` laws with `hkj-test` is not supported yet, so the test checks them by hand, for `bigDecimalAddition` and for the units monoid. It uses these imports, with JUnit's:

<!-- verify -->
```java
import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;
import org.higherkindedj.example.book.foundations.monoid.MonoidBook;
import org.higherkindedj.hkt.Monoid;
import org.higherkindedj.hkt.Monoids;
```

```java
  <A> void assertMonoidLaws(Monoid<A> monoid, A a, A b, A c) {
    // combining with empty, on either side, changes nothing
    assertThat(monoid.combine(monoid.empty(), a)).isEqualTo(a);
    assertThat(monoid.combine(a, monoid.empty())).isEqualTo(a);
    // grouping the combines differently changes nothing
    assertThat(monoid.combine(monoid.combine(a, b), c))
        .isEqualTo(monoid.combine(a, monoid.combine(b, c)));
  }

  @Test
  @DisplayName("BigDecimal addition and the page's units monoid keep the monoid laws")
  void monoidLaws() {
    assertMonoidLaws(
        Monoids.bigDecimalAddition(),
        new BigDecimal("40.00"),
        new BigDecimal("10.00"),
        new BigDecimal("7.50"));
    assertMonoidLaws(
        MonoidBook.UNITS, Map.of("LAMP", 1), Map.of("BULB", 4), Map.of("BULB", 3, "DESK", 1));
  }

```
~~~

---

## Things people get wrong {#things-people-get-wrong}

~~~admonish warning title="Common Misunderstandings"
- **"`doubleAddition` will do for money."** It rounds: `0.1` and `0.2` give `0.30000000000000004`, where `bigDecimalAddition` sums `0.10` and `0.20` to exactly `0.30`.
- **"Every monoid in `Monoids` keeps the laws."** The `double` ones do not, since each `+` or `*` rounds. Combining `1e16`, `-1e16` and `1` gives `1.0` grouped as `(1e16 + -1e16) + 1`, and `0.0` grouped as `1e16 + (-1e16 + 1)`.
- **"`combine` must be commutative."** It must be associative, and that is all. `Monoids.string()` combines `"LAMP"` and `"BULB"` into `"LAMPBULB"`, and the other way round into `"BULBLAMP"`.
- **"Any semigroup becomes a monoid once you name an empty value."** Only if that value changes nothing. The `combineAll` of `Monoid.of("", Semigroups.string(", "))` turns `"LAMP"` and `"BULB"` into `", LAMP, BULB"`: it starts from `""`, and joining `""` adds a delimiter.
- **"`isEmpty` always compares with `equals`."** `bigDecimalAddition`'s is true for zero at any scale, so `0.00` is empty, although `BigDecimal.ZERO.equals(new BigDecimal("0.00"))` is false.
~~~

---

## The fine print {#the-fine-print}

### What takes a Semigroup or a Monoid {#what-takes-a-semigroup-or-a-monoid}

- **`Instances.eitherOrBoth(semigroup)` joins the warnings each step carries.** [EitherOrBoth](../monads/either_or_both_monad.md) shows how.
- **`Instances.writer(monoid)` combines each step's log, starting from the empty log.** [Writer](../monads/writer_monad.md) shows how.
- **`Foldable.foldMap(monoid, f, fa)` turns each element into a monoid value and combines them.** [Foldable and Traverse](foldable_and_traverse.md) shows how.
- **`Const`'s `Applicative` takes a monoid to combine what it collects.** [Const](../monads/const_type.md) shows how.

---

~~~admonish tip title="See Also"
- [Foldable and Traverse](foldable_and_traverse.md): folding any container with a monoid
- [Applicative](applicative.md): how `Validated` combines errors with a semigroup
- [Multi-Edit and Sparse Updates](../optics/multi_edit.md): the `Edits` builder that `Monoids.update()` powers
~~~

---

**Previous:** [Type Classes](ch_intro.md)
**Next:** [Foldable and Traverse](foldable_and_traverse.md)
