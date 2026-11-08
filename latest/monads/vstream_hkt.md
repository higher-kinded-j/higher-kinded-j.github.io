<!-- description: VStream's type class instances in Java: pass a stream to generic code over Functor, Monad, Alternative or Traverse, and see what ap and orElse do. -->

# VStream and the Type Classes

_Pass a stream to code written once for any container, over `Functor`, `Monad`, `Alternative` or `Traverse`._

~~~admonish info title="What You'll Learn"
- Write a function once over `Functor`, and use it with a stream, a list and a `Maybe`
- Get `VStream`'s instances from `Instances`, and know which class each one is
- Say what `ap` and `orElse` do with a stream, and why `ap` suits only a finite one
- Fold and traverse a finite stream, knowing that both read it as soon as they are called
- Check that the instances keep their laws, with `hkj-test`
~~~

~~~admonish example title="See Example Code"
**The code on this page is [VStreamHktBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/vstream/VStreamHktBook.java)**: the page includes it, so the build compiles and runs it. [VStreamHktBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/vstream/VStreamHktBookTest.java) holds what the page says each instance does, and checks the laws.
~~~

---

Most code uses a stream through its own methods, or on a [`VStreamPath`](../effect/path_vstream.md). This page is for code written once for any container, such as a helper over `Functor<F>` that a stream, a list and a `Maybe` all pass through. The [Foundations](../hkts/foundations_intro.md) introduction's "Which level am I working at?" tip says which you need.

## One function for every container {#one-function-for-every-container}

The code on this page uses these imports, with the order feed and the orders from the [VStream](vstream.md#reading-a-feed-one-page-at-a-time) page:

<!-- verify -->
```java
import static org.higherkindedj.hkt.instances.Witnesses.list;
import static org.higherkindedj.hkt.instances.Witnesses.maybe;
import static org.higherkindedj.hkt.instances.Witnesses.vstream;
import static org.higherkindedj.hkt.list.ListKindHelper.LIST;
import static org.higherkindedj.hkt.maybe.MaybeKindHelper.MAYBE;
import static org.higherkindedj.hkt.vstream.VStreamKindHelper.VSTREAM;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Function;
import org.higherkindedj.hkt.Alternative;
import org.higherkindedj.hkt.Applicative;
import org.higherkindedj.hkt.Functor;
import org.higherkindedj.hkt.Kind;
import org.higherkindedj.hkt.Monoids;
import org.higherkindedj.hkt.Traverse;
import org.higherkindedj.hkt.TypeArity;
import org.higherkindedj.hkt.WitnessArity;
import org.higherkindedj.hkt.instances.Instances;
import org.higherkindedj.hkt.maybe.Maybe;
import org.higherkindedj.hkt.maybe.MaybeKind;
import org.higherkindedj.hkt.vstream.VStream;
import org.higherkindedj.hkt.vstream.VStreamKind;
import org.higherkindedj.hkt.vstream.VStreamTraverse;
```

`customers` is written once, for any `Functor`, and names no container:

```java
  // Written once, for any Functor: the customer of each order
  static <F extends WitnessArity<TypeArity.Unary>> Kind<F, String> customers(
      Functor<F> functor, Kind<F, Order> orders) {
    return functor.map(VStreamBook::customer, orders);
  }

```

A stream read from the feed, a list and a `Maybe` all pass through it. `Instances.functor` gives each container's `Functor` from its token, such as `vstream()`:

```java
    Kind<VStreamKind.Witness, String> streamed =
        customers(Instances.functor(vstream()), VSTREAM.widen(orders(new PagedFeed(ORDERS))));
    List<String> fromTheFeed = VSTREAM.narrow(streamed).toList().run();
    // [Ada, Grace, Alan, Edsger, Barbara, Ken]
    List<String> fromAList = LIST.narrow(customers(Instances.functor(list()), LIST.widen(ORDERS)));
    // [Ada, Grace, Alan, Edsger, Barbara, Ken]
    Maybe<String> fromAMaybe =
        MAYBE.narrow(
            customers(Instances.functor(maybe()), MAYBE.widen(Maybe.just(ORDERS.getFirst()))));
    // Just(Ada)
```

For the stream, `map` stays lazy: the feed is read only when `toList()` runs.

## The instances {#the-instances}

Generic code takes a container through its instances, as [Working with Kind](vstream.md#working-with-kind) on the VStream page shows for `Monad`. These are `VStream`'s:

| Type class | Get it with | Instance |
|---|---|---|
| `Functor`, `Applicative`, `Monad`, `Alternative` | `Instances.functor(vstream())`, or `applicative`, `monad` or `alternative` | `VStreamAlternative.INSTANCE`, which extends `VStreamMonad` |
| `Foldable`, `Traverse` | `VStreamTraverse.INSTANCE` | `VStreamTraverse` |

All four lookups give that one object, viewed as each type class. `VStream` has no `MonadZero` and no `Selective`, so `Instances.monadZero(vstream())` compiles but throws a `ClassCastException`. [The hierarchy](../functional/ch_intro.md#the-hierarchy) shows how the type classes extend each other.

## `ap` pairs every function with every value {#ap-pairs-every-function-with-every-value}

[`Applicative`](../functional/applicative.md)'s `ap` applies each function in the first stream to every value in the second, each function in turn, as `List`'s `ap` does. Two delivery services for the first two paid customers give four offers:

```java
    PagedFeed feed = new PagedFeed(ORDERS);
    Kind<VStreamKind.Witness, String> firstTwoPaid =
        VSTREAM.widen(orders(feed).filter(VStreamBook::paid).map(VStreamBook::customer).take(2));
    Kind<VStreamKind.Witness, Function<String, String>> services =
        VSTREAM.widen(
            VStream.<Function<String, String>>of(
                name -> "standard for " + name, name -> "express for " + name));

    Applicative<VStreamKind.Witness> applicative = Instances.applicative(vstream());
    List<String> offers = VSTREAM.narrow(applicative.ap(services, firstTwoPaid)).toList().run();
    // [standard for Ada, standard for Alan, express for Ada, express for Alan]
    List<Integer> fetched = feed.fetched();
    // [1, 2]
```

The feed was read once, though two functions used its values. Each run of the result reads the value stream to its end before it gives its first element, then holds those values for every function.

~~~admonish warning title="ap reads every value first"
On an endless value stream, `ap` never gives an element. To pair the elements of two streams one with one, use `zipWith`, from [Shaping a stream](vstream.md#shaping-a-stream).
~~~

## `orElse` joins two streams {#orelse-joins-two-streams}

For a stream, `orElse` is `concat`: it gives every element of the first, then every element of the second, and builds the second only once the first has ended. `empty()` is a stream with no elements:

```java
    Alternative<VStreamKind.Witness> alternative = Instances.alternative(vstream());
    Kind<VStreamKind.Witness, String> london = VSTREAM.widen(VStream.of("Ada", "Alan"));
    Kind<VStreamKind.Witness, String> edinburgh = VSTREAM.widen(VStream.of("Edsger", "Ken"));

    List<String> both = VSTREAM.narrow(alternative.orElse(london, () -> edinburgh)).toList().run();
    // [Ada, Alan, Edsger, Ken]
    List<String> londonOnly =
        VSTREAM.narrow(alternative.orElse(london, () -> alternative.empty())).toList().run();
    // [Ada, Alan]
```

This is not a fallback. `Maybe`'s `orElse` uses its second value only when the first is `Nothing`, while a stream's joins the second even when the first has elements. [One method, two meanings](../functional/alternative.md#one-method-two-meanings) sets the two side by side. `guard(true)` gives a stream of one element, and `guard(false)` an empty one.

## Folding and traversing a finite stream {#folding-and-traversing-a-finite-stream}

`foldMap`, from [Foldable](../functional/foldable_and_traverse.md), maps each element to a value of a [`Monoid`](../functional/semigroup_and_monoid.md), then combines them all. Here each paid order's value is added up, at 40.00 an order:

```java
  // What an order is worth: each line's price times its quantity
  static BigDecimal value(Order order) {
    return order.lines().stream()
        .map(line -> line.price().multiply(BigDecimal.valueOf(line.quantity())))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

```

```java
    Traverse<VStreamKind.Witness> traverse = VStreamTraverse.INSTANCE;
    Kind<VStreamKind.Witness, Order> paidOrders =
        VSTREAM.widen(orders(new PagedFeed(ORDERS)).filter(VStreamBook::paid));

    BigDecimal paidValue =
        traverse.foldMap(Monoids.bigDecimalAddition(), VStreamHktBook::value, paidOrders);
    // 160.00
```

`traverse` applies an effectful function to each element, and gives one effect holding a stream of the results. `POSTCODES` holds a postcode for each paid customer, and none for Grace or Barbara. So with `Maybe`, `traverse` gives `Just` over the paid orders, and `Nothing` over every order:

```java
    Function<Order, Kind<MaybeKind.Witness, String>> postcode =
        order -> MAYBE.widen(Maybe.fromNullable(POSTCODES.get(customer(order))));

    Kind<MaybeKind.Witness, Kind<VStreamKind.Witness, String>> forThePaid =
        traverse.traverse(Instances.applicative(maybe()), postcode, paidOrders);
    Maybe<List<String>> labels =
        MAYBE.narrow(forThePaid).map(stream -> VSTREAM.narrow(stream).toList().run());
    // Just([N1 9GU, M13 9PL, CB2 1TN, EH8 9YL])

    Kind<VStreamKind.Witness, Order> everyOrder = VSTREAM.widen(orders(new PagedFeed(ORDERS)));
    Maybe<Kind<VStreamKind.Witness, String>> forEveryOrder =
        MAYBE.narrow(traverse.traverse(Instances.applicative(maybe()), postcode, everyOrder));
    // Nothing
```

~~~admonish warning title="foldMap and traverse run the stream when they are called"
Neither gives a `VTask`. Each reads the whole stream there and then, on the calling thread, and `traverse` holds every element while it works. So neither returns on an endless stream: bound it first with `take` or `takeWhile`. A checked exception from the stream reaches the caller inside a `VTaskExecutionException`, as [`VTask.run()`](vtask_monad.md#running-a-task) hands one over. In application code, prefer the stream's own `fold`, which gives a `VTask`, as [Running a stream](vstream.md#running-a-stream) shows.
~~~

## Laws {#laws}

The book's own test checks that `VStream`'s instances keep their laws, with the law checkers that `hkj-test` ships.

~~~admonish note title="Laws"
Two streams count as the same when a run of each gives the same elements in the same order. On that measure, `VStream`'s instances keep the laws of [Functor](../functional/functor.md#two-laws), [Applicative](../functional/applicative.md#four-laws) and [Monad](../functional/monad.md#three-laws), and `Traverse`'s identity law, the one [`hkj-test`](../tooling/test_assertions.md#adding-the-dependency) checks. The test also checks that `widen` then `narrow` gives back the stream it started with. It uses the orders from the VStream page, with these imports and JUnit's:

<!-- verify -->
```java
import static org.higherkindedj.hkt.instances.Witnesses.vstream;
import static org.higherkindedj.hkt.vstream.VStreamKindHelper.VSTREAM;

import java.util.function.BiPredicate;
import java.util.function.Function;
import org.higherkindedj.example.book.optics.cast.Customer;
import org.higherkindedj.example.book.optics.cast.LineItem;
import org.higherkindedj.example.book.optics.cast.Order;
import org.higherkindedj.hkt.Kind;
import org.higherkindedj.hkt.Monad;
import org.higherkindedj.hkt.assertions.KindEquivalence;
import org.higherkindedj.hkt.instances.Instances;
import org.higherkindedj.hkt.laws.ApplicativeLaws;
import org.higherkindedj.hkt.laws.FunctorLaws;
import org.higherkindedj.hkt.laws.KindHelperLaws;
import org.higherkindedj.hkt.laws.MonadLaws;
import org.higherkindedj.hkt.laws.TraverseLaws;
import org.higherkindedj.hkt.vstream.VStream;
import org.higherkindedj.hkt.vstream.VStreamKind;
import org.higherkindedj.hkt.vstream.VStreamTraverse;
```

```java
  // Two streams are the same when a run of each gives the same elements in the same order
  private static final BiPredicate<Kind<VStreamKind.Witness, ?>, Kind<VStreamKind.Witness, ?>>
      SAME = KindEquivalence.byEqualsAfter(kind -> VSTREAM.narrow(kind).toList().run());

  @Test
  @DisplayName("VStream's instances keep the Functor, Applicative, Monad and Traverse laws")
  void laws() {
    Monad<VStreamKind.Witness> monad = Instances.monad(vstream());
    Order ada = ORDERS.getFirst();
    Kind<VStreamKind.Witness, Order> orders = VSTREAM.widen(VStream.fromList(ORDERS));
    Function<Order, Kind<VStreamKind.Witness, LineItem>> lines =
        order -> VSTREAM.widen(VStream.fromList(order.lines()));
    Function<LineItem, Kind<VStreamKind.Witness, String>> skus =
        line -> VSTREAM.widen(VStream.of(line.sku(), line.sku() + " spare"));
    Kind<VStreamKind.Witness, Function<Order, Customer>> customer =
        VSTREAM.widen(VStream.of(Order::customer));
    Kind<VStreamKind.Witness, Function<Customer, String>> name =
        VSTREAM.widen(VStream.of(Customer::name));

    FunctorLaws.assertIdentity(monad, orders, SAME);
    FunctorLaws.assertComposition(monad, orders, Order::customer, Customer::name, SAME);
    ApplicativeLaws.assertIdentity(monad, orders, SAME);
    ApplicativeLaws.assertHomomorphism(monad, ada, Order::customer, SAME);
    ApplicativeLaws.assertInterchange(monad, customer, ada, SAME);
    ApplicativeLaws.assertComposition(monad, name, customer, orders, SAME);
    MonadLaws.assertLeftIdentity(monad, ada, lines, SAME);
    MonadLaws.assertRightIdentity(monad, orders, SAME);
    MonadLaws.assertAssociativity(monad, orders, lines, skus, SAME);
    TraverseLaws.assertIdentity(VStreamTraverse.INSTANCE, orders, SAME);
    KindHelperLaws.assertRoundTrip(VStream.fromList(ORDERS), VSTREAM::widen, VSTREAM::narrow);
  }

```

Checking `Alternative`'s laws with `hkj-test` is not supported yet. The library's own tests check that `empty()` is an identity on both sides of `orElse`, and that `orElse` is associative.
~~~

## How `VStream` compares {#how-vstream-compares}

| | `VStream` | `List` | Java `Stream` | `Maybe` |
|---|---|---|---|---|
| `of(a)` | A stream of one element | `[a]` | A stream of one element | `Just(a)` |
| `ap` | Every function over every value, the values read at each run | Every function over every value | Every function over every value, the values read when `ap` is called | `Just` when both are |
| `orElse` | Both, joined | Both, joined | Both, joined | The first `Just` |
| `foldMap` | Reads the stream when called | Folds the list | Reads the stream when called | The value's, or the empty value |
| Each element | Produced by a task when pulled | Already in memory | Produced when pulled, once only | Already in memory |

~~~admonish info title="Hands-On Learning"
Practise `VStream`'s instances in [TutorialVStreamHKT](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/concurrency/TutorialVStreamHKT.java) (10 exercises).
~~~

---

**Previous:** [VStream](vstream.md)
**Next:** [Parallel Operations](vstream_parallel.md)
