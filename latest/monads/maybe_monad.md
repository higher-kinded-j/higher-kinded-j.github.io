<!-- description: Return a value that may be missing from a Java method with Maybe instead of null, chain lookups that may find nothing, and give the absence a reason. -->

# Maybe: Representing Optional Values

_Return a value that may be missing, without ever handing back `null`._

~~~admonish abstract title="Maybe at a glance"
| | |
|---|---|
| **Models** | A value, or nothing, and never `null` |
| **Replaces** | A method that may return `null` |
| **Effect Path** | [`MaybePath`](../effect/path_maybe.md) |
| **Instances** | `Functor`, `Applicative`, `Selective`, `Monad`, `MonadError<Unit>`, `Alternative`, `MonadZero`, `Foldable`, `Traverse` |
| **Choose it when** | Absence needs no reason; otherwise [Either](either_monad.md), or compare every type in [Choosing a Type](supported-types.md#choosing-a-type) |
~~~

~~~admonish info title="What You'll Learn"
- Turn a lookup that may return `null` into a `Maybe`, once, where the value comes in
- Chain lookups that may each find nothing, and say when a later one runs
- Read a `Maybe` with a fallback, or give its absence a reason with `toEither`
- Hand a `Maybe` to code that takes an `Optional` or a `Stream`
- Use `Maybe` in generic code through its `MonadError` instance
~~~

~~~admonish example title="See Example Code"
**The code on this page is [MaybeBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/maybe/MaybeBook.java)**: the page includes it, so the build compiles and runs it. [MaybeBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/maybe/MaybeBookTest.java) holds what the page says each method does.
~~~

---

## Absence without `null` {#absence-without-null}

`Map.get` returns `null` for a key it does not hold, and so do many older APIs. Nothing in the signature says so, and code that forgets to check fails later with a `NullPointerException`. A `Maybe<T>` is a value that may be missing, with the missing case in the type: a `Just` holds a value, which is never `null`, and `Nothing` holds none. It is close to Java's `Optional`, which [Optional](optional_monad.md) covers, and treats `null` the same way: `Maybe.just`, like `Optional.of`, refuses it.

The code on this page uses these imports, with `Order`, `Consignment` and `Address` from the order records the [Optics](../optics/ch_intro.md) chapter introduces:

<!-- verify -->
```java
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.higherkindedj.example.book.foundations.OrderError;
import org.higherkindedj.example.book.optics.cast.Address;
import org.higherkindedj.example.book.optics.cast.Consignment;
import org.higherkindedj.example.book.optics.cast.Order;
import org.higherkindedj.hkt.either.Either;
import org.higherkindedj.hkt.maybe.Maybe;
```

`ORDERS` and `CONSIGNMENTS` are `Map`s keyed by order id, and only an order that has shipped has a consignment. Each lookup turns `Map.get`'s `null` into `Nothing`, once, where the value comes in:

```java
  // Map.get gives null for a missing key, and fromNullable turns that null into Nothing
  static Maybe<Order> findOrder(UUID id) {
    return Maybe.fromNullable(ORDERS.get(id));
  }

  static Maybe<Consignment> findConsignment(Order order) {
    return Maybe.fromNullable(CONSIGNMENTS.get(order.id()));
  }

  static Maybe<Order> findArchived(UUID id) {
    return Maybe.fromNullable(ARCHIVE.get(id));
  }

```

## Chaining lookups {#chaining-lookups}

`flatMap` runs the next lookup on a `Just`'s value, and `map` changes the value. On `Nothing`, neither runs, and `Nothing` reaches the end:

```java
  static Maybe<Address> deliveryAddress(UUID id) {
    return findOrder(id).flatMap(MaybeBook::findConsignment).map(Consignment::to);
  }

```

`PLACED` has not shipped, `SHIPPED` has, and no order has the id `UNKNOWN`:

```java
    Maybe<Address> dispatched = deliveryAddress(SHIPPED.id());
    // Just(Address[street=1 High Street, city=Leeds, postcode=LS1 4AP])
    Maybe<Address> notDispatched = deliveryAddress(PLACED.id());
    // Nothing
    Maybe<Address> noSuchOrder = deliveryAddress(UNKNOWN);
    // Nothing
```

The two `Nothing` results look the same: one order has not shipped, and the other does not exist. `Maybe` says only that something is missing, not why.

## Reading a `Maybe` {#reading-a-maybe}

`orElse` gives a fallback for `Nothing`, but its text cannot say why the value is missing: an unknown order reads "not dispatched yet" too. When the caller needs the reason, `toEither` gives the absence one, and the chain continues as an [Either](either_monad.md):

```java
    String city = deliveryAddress(PLACED.id()).map(Address::city).orElse("not dispatched yet");

    Either<OrderError, Order> withReason =
        findOrder(UNKNOWN).toEither(OrderError.notFound(UNKNOWN));
    // Left(NotFound[orderId=00000000-0000-0000-0000-000000000009])
```

`city` is `"not dispatched yet"`. `get()` returns a `Just`'s value and throws `NoSuchElementException` on `Nothing`, so keep it for tests. `Just` and `Nothing` are not public types, so a `switch` cannot name them: read a `Maybe` through its methods.

## Bridging to the JDK {#interacting-with-maybe-values}

`toOptional()` hands a `Maybe` to code that takes an `Optional`, and `Maybe.fromOptional` brings one back. Neither conversion can fail, because neither type holds `null`. `stream()` gives a stream of zero or one element, so `flatMap(Maybe::stream)` keeps only the lookups that found something:

```java
    Optional<Address> forJdkCode = deliveryAddress(SHIPPED.id()).toOptional();
    // Optional[Address[street=1 High Street, city=Leeds, postcode=LS1 4AP]]

    // Keep only the ids that find an order
    List<UUID> found =
        Stream.of(PLACED.id(), UNKNOWN, SHIPPED.id())
            .map(MaybeBook::findOrder)
            .flatMap(Maybe::stream)
            .map(Order::id)
            .toList();
    // [00000000-0000-0000-0000-000000000001, 00000000-0000-0000-0000-000000000002]
```

Among the library's types that can fail, only `Maybe` has `stream()`, as `Optional` does. An empty stream says that a value is missing, while the same conversion on `Either` or `Try` would drop the error it holds.

## Creating instances {#creating-instances}

`Maybe.just(value)` builds a `Just`, and throws `NullPointerException` for `null`. `Maybe.fromNullable(value)` gives `Nothing` for `null`, and `Maybe.nothing()` gives `Nothing` directly. `Maybe`'s `map` gives `Nothing`, rather than failing, when its function returns `null`, and its instance's `of(null)` gives `Nothing` too, as [Values, never null](../hkts/core-concepts.md#values-never-null) sets out.

## On a `MaybePath` {#on-a-maybepath}

Application code can hold the same chain on a [`MaybePath`](../effect/path_maybe.md). `Path.maybe` takes a `Maybe`, or a value that may be `null`, `via` chains the next lookup, and `getOrElse` reads it. These are the extra imports:

<!-- verify -->
```java
import org.higherkindedj.hkt.effect.MaybePath;
import org.higherkindedj.hkt.effect.Path;
```

```java
  static MaybePath<String> deliveryCity(UUID id) {
    return Path.maybe(findOrder(id))
        .via(order -> Path.maybe(findConsignment(order)))
        .map(consignment -> consignment.to().city());
  }

```

```java
    MaybePath<String> leeds = deliveryCity(SHIPPED.id());
    // MaybePath(Just(Leeds))
    String unknownCity = deliveryCity(UNKNOWN).getOrElse("unknown");
```

`unknownCity` is `"unknown"`.

## Methods {#methods}

| Method | What it does |
|---|---|
| `Maybe.just(value)`, `Maybe.nothing()` | Build a `Just`, throwing `NullPointerException` for `null`, or `Nothing` |
| `Maybe.fromNullable(value)` | Gives `Nothing` for `null`, and a `Just` otherwise |
| `Maybe.fromOptional(optional)`, `toOptional()` | Convert from and to Java's `Optional` |
| `isJust()`, `isNothing()` | Say which case it holds |
| `map(f)` | Changes a `Just`'s value; a function that returns `null` gives `Nothing` |
| `flatMap(f)` | Runs a step that gives a `Maybe` on a `Just`'s value; `Nothing` passes through |
| `orElse(other)`, `orElseGet(supplier)` | Return the value, or a fallback |
| `toEither(error)`, `toEither(supplier)` | Give an `Either` whose `Left` says why the value is missing |
| `stream()` | Gives a stream of zero or one element |
| `get()` | Returns the value, or throws `NoSuchElementException` on `Nothing` |

## Working with Kind {#working-with-kind}

Generic code, written once for any container, takes `Maybe` through its `MonadError` instance, as [MonadError](../functional/monad_error.md) shows. Its error type is `Unit`: `Nothing` is the error, and it carries no detail. The instance works over `Kind<MaybeKind.Witness, A>`, so you widen a `Maybe` to pass it in, and narrow the result to read it. These are the extra imports:

<!-- verify -->
```java
import static org.higherkindedj.hkt.instances.Witnesses.maybe;
import static org.higherkindedj.hkt.maybe.MaybeKindHelper.MAYBE;

import org.higherkindedj.hkt.Kind;
import org.higherkindedj.hkt.MonadError;
import org.higherkindedj.hkt.Unit;
import org.higherkindedj.hkt.instances.Instances;
import org.higherkindedj.hkt.maybe.MaybeKind;
```

`ARCHIVED` is an order that has moved to the archive, so `findOrder` misses it and `findArchived` finds it there:

```java
    MonadError<MaybeKind.Witness, Unit> absence = Instances.monadError(maybe());

    Kind<MaybeKind.Witness, Order> lookedUp = MAYBE.widen(findOrder(ARCHIVED.id()));
    Kind<MaybeKind.Witness, Order> orArchived =
        absence.handleErrorWith(lookedUp, unit -> MAYBE.widen(findArchived(ARCHIVED.id())));

    Maybe<Order> fromArchive = MAYBE.narrow(orArchived);
    // Just(Order[id=00000000-0000-0000-0000-000000000003, ...])
    Maybe<Order> raised = MAYBE.narrow(absence.raiseError(Unit.INSTANCE));
    // Nothing
```

Widening allocates nothing: `Maybe` implements `MaybeKind` itself, so `widen` checks for `null` and returns the same object, and `Nothing` is one shared instance. `Maybe` has instances of other type classes too, such as `Selective` and `Traverse`, each an object of its own, and *Maybe at a glance*, at the head of the page, lists them.

## Back to the one-liner {#back-to-the-one-liner}

```java
  static EitherPath<OrderError, Order> changeEmail(
      OrderRepository orders, UUID id, String newEmail) {
    return orders
        .find(id)
        .toEitherPath(OrderError.notFound(id))
        .map(order -> OrderFocus.customer().email().value().set(newEmail, order))
        .via(orders::save);
  }

```

[The one-liner](../hkts/one_line_six_layers.md) starts with `orders.find(id)`, which gives a `MaybePath`: the order, or nothing. `toEitherPath(OrderError.notFound(id))` gives that absence a reason, so the rest of the line can fail with an `OrderError`. A `MaybePath` holds a `Maybe` and calls its methods directly.

## When to use `Maybe` {#when-to-use-maybe}

| You need | Use |
|---|---|
| A value that may be missing, in code you control | `Maybe` |
| The same lookups as a fluent chain in application code | [MaybePath](../effect/path_maybe.md) |
| To work with an API that returns `Optional` | [Optional](optional_monad.md), or bridge with `fromOptional` and `toOptional` |
| A missing value that must say why | [Either](either_monad.md), converting with `toEither` |

~~~admonish info title="Hands-On Learning"
Practise `Maybe.just`, `Maybe.nothing` and converting to `Either`, beside `Either` and `Validated`, in [Tutorial 06: Concrete Types](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/coretypes/Tutorial06_ConcreteTypes.java) (7 exercises).
~~~

**Benchmarks:** `MaybeBenchmark` measures how cheaply `Nothing` passes along a chain, and the cost of `fromNullable`. [Benchmarks & Performance](../benchmarks.md) says how to run it.

---

**Previous:** [NonEmptyList](nonemptylist_monad.md)
**Next:** [Optional](optional_monad.md)
