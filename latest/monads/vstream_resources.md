<!-- description: Release what a VStream opens with bracket and onFinalize: once for each run, however the run ends, even when the consumer stops early. -->

# Resource-Safe Streaming: Release What a Stream Opens

_Open a connection when a run starts, and close it however the run ends._

~~~admonish info title="What You'll Learn"
- Open a resource for each run with `bracket`, and say when it is released, even when `take` stops early
- Predict what a run reports when reading fails, and when the release itself fails
- Nest brackets, and read one resource after another
- Attach cleanup to any stream with `onFinalize`
- Close a stream you pull by hand
~~~

~~~admonish example title="See Example Code"
**The code on this page is [VStreamResourcesBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/vstream/VStreamResourcesBook.java) and [VStreamLinesBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/vstream/VStreamLinesBook.java):** the page includes them, so the build compiles and runs them. [VStreamResourcesBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/vstream/VStreamResourcesBookTest.java) holds what the page says about each release.
~~~

---

## A stream that holds a connection {#a-stream-that-holds-a-connection}

A stream reads nothing until it runs, so a `try`-with-resources block around the code that builds it closes the connection before the first element is read. The connection has to be opened by the run, and closed when the run ends.

The code reuses the order feed from the [VStream](vstream.md#reading-a-feed-one-page-at-a-time) page. `orders(feed)` streams every order in a feed, and `PagedFeed` serves `ORDERS`, six orders of which four are paid, two to a page. `new PagedFeed(ORDERS, 2)` fails at page 2, and `shippingQuotes(orders, courier)` asks a courier to quote for each paid order. With `Order` from the [Optics](../optics/ch_intro.md) chapter, these are the imports:

<!-- verify -->
```java
import java.io.Closeable;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.higherkindedj.example.book.optics.cast.Order;
import org.higherkindedj.hkt.Unit;
import org.higherkindedj.hkt.effect.Path;
import org.higherkindedj.hkt.effect.VStreamPath;
import org.higherkindedj.hkt.trymonad.Try;
import org.higherkindedj.hkt.vstream.VStream;
import org.higherkindedj.hkt.vtask.VTask;
```

The feed is now read over a connection, which a service opens. `OrderFeed` and `Courier` are the VStream page's services:

```java
  // A service opens a connection to the order feed, or a session with a courier. Each is
  // closed once the stream is done with it, and opening or closing may throw an IOException
  interface FeedService {
    FeedConnection open() throws IOException;
  }

  interface FeedConnection extends OrderFeed, Closeable {}

  interface CourierService {
    CourierSession open() throws IOException;
  }

  interface CourierSession extends Courier, Closeable {}

```

## `bracket` opens and closes {#bracket-opens-and-closes}

`VStream.bracket(acquire, use, release)` opens a resource when a run starts, reads the stream `use` builds from it, and releases it however the run ends:

```java
  // Every order, read over a connection that is opened when a run starts and closed however
  // the run ends
  static VStream<Order> ordersOver(FeedService service) {
    return VStream.bracket(
        VTask.of(service::open), VStreamBook::orders, VStreamResourcesBook::closing);
  }

  // close() can throw an IOException, so it runs in VTask.of; VTask.exec takes a Runnable,
  // which cannot throw one
  static VTask<Unit> closing(Closeable resource) {
    return VTask.of(
        () -> {
          resource.close();
          return Unit.INSTANCE;
        });
  }

```

`LoggedFeedService(log)` serves `ORDERS` over each connection it opens, and writes each open, page and close to `log`, so the log shows what a run did:

```java
    List<String> log = new CopyOnWriteArrayList<>();
    VStream<String> paidCustomers =
        ordersOver(new LoggedFeedService(log)).filter(VStreamBook::paid).map(VStreamBook::customer);
    List<String> beforeRunning = List.copyOf(log);
    // []
    List<String> paid = paidCustomers.toList().run();
    // [Ada, Alan, Edsger, Ken]
    List<String> afterOneRun = List.copyOf(log);
    // [feed opened, page 1, page 2, page 3, page 4, feed closed]
```

Building the stream opened nothing. The run opened the connection, read every page up to the empty page 4, which ends the feed, and closed it. Each run opens a connection of its own, and closes it:

```java
    paidCustomers.toList().run();
    int opened = Collections.frequency(log, "feed opened");
    // 2
    int closed = Collections.frequency(log, "feed closed");
    // 2
```

## Stopping early {#stopping-early}

A consumer that stops before the end still closes the connection:

```java
    List<String> earlyLog = new CopyOnWriteArrayList<>();
    List<String> firstTwo =
        ordersOver(new LoggedFeedService(earlyLog))
            .filter(VStreamBook::paid)
            .map(VStreamBook::customer)
            .take(2)
            .toList()
            .run();
    // [Ada, Alan]
    List<String> earlyRun = List.copyOf(earlyLog);
    // [feed opened, page 1, page 2, feed closed]
```

`take(2)` closes the rest of the stream once it has its two elements, so page 3 is never read. `takeWhile`, `zipWith`, `headOption`, `find`, `exists` and `forAll` close the rest in the same way when they stop.

## A file, a line at a time {#a-file-a-line-at-a-time}

A file is read the same way, with `java.nio.file.Files`, `java.nio.file.Path` and `java.util.Optional`. The reader opens when a run starts, and closes when the run reaches the end of the file, fails, or stops early:

```java
  // Each line of a file. The reader is opened when a run starts, and closed when the run
  // reaches the end of the file, fails, or stops early
  static VStream<String> lines(Path file) {
    return VStream.bracket(
        VTask.of(() -> Files.newBufferedReader(file)),
        reader ->
            VStream.unfold(
                reader,
                current ->
                    VTask.of(
                        () ->
                            Optional.ofNullable(current.readLine())
                                .map(line -> new VStream.Seed<>(line, current)))),
        VStreamResourcesBook::closing);
  }

```

```java
      // A file of three lines: Ada,PAID then Grace,NEW then Alan,PAID
      Files.write(ordersCsv, List.of("Ada,PAID", "Grace,NEW", "Alan,PAID"));
      List<String> firstTwo = lines(ordersCsv).take(2).toList().run();
      // [Ada,PAID, Grace,NEW]
```

`java.nio.file.Path` and the library's `Path` share a name, so code that uses both imports one and writes the other in full. The example keeps the file in a class of its own.

## When something fails {#when-something-fails}

A failure closes the connection too, and a close that fails is reported. `new LoggedFeedService(log, feed)` serves another feed, and `LoggedFeedService.failingToClose(log, feed)` gives connections whose close throws:

```java
    List<String> downLog = new CopyOnWriteArrayList<>();
    Try<List<Order>> feedDown =
        ordersOver(new LoggedFeedService(downLog, new PagedFeed(ORDERS, 2))).toList().runSafe();
    // Failure(java.io.IOException: the order feed is down)
    List<String> downRun = List.copyOf(downLog);
    // [feed opened, page 1, page 2, feed closed]

    Try<List<Order>> stuck =
        ordersOver(LoggedFeedService.failingToClose(downLog, new PagedFeed(ORDERS)))
            .toList()
            .runSafe();
    // Failure(java.io.IOException: the connection would not close)
```

| What fails | What happens |
|---|---|
| Reading, such as a page of the feed | The connection is closed, then the stream fails with the reading's own exception |
| `use`, while it builds the stream | The connection is closed, then the stream fails with `use`'s exception |
| The release, after a run that succeeded | The operation that ended the run, such as `toList`, fails with the release's exception |
| The release, after a run that failed | Its exception is suppressed onto the run's failure, in `getSuppressed()` |

`runSafe()` gives each failure as it was thrown. `run()` hands a checked one over inside a `VTaskExecutionException`, with the original as its cause, as [Running a task](vtask_monad.md#running-a-task) explains.

## Nested brackets, and one resource after another {#nested-brackets}

A bracket inside another holds its resource inside the outer one's, and releases it first. Here a courier session, whose quotes are 4.99 as `COURIER`'s are, is opened inside the feed connection:

```java
  // A courier session opened inside the feed connection, so it is closed first
  static VStream<BigDecimal> quotesOver(FeedService feeds, CourierService couriers) {
    return VStream.bracket(
        VTask.of(feeds::open),
        connection ->
            VStream.bracket(
                VTask.of(couriers::open),
                session -> shippingQuotes(orders(connection), session),
                VStreamResourcesBook::closing),
        VStreamResourcesBook::closing);
  }

```

```java
    List<String> nestedLog = new CopyOnWriteArrayList<>();
    List<BigDecimal> quotes =
        quotesOver(new LoggedFeedService(nestedLog), new LoggedCourierService(nestedLog))
            .toList()
            .run();
    // [4.99, 4.99, 4.99, 4.99]
    List<String> nestedRun = List.copyOf(nestedLog);
    // [feed opened, courier opened, page 1, page 2, page 3, page 4, courier closed, feed closed]
```

To read one resource after another, join the brackets outside each other, with `concat`. Each connection is closed before the next is opened:

```java
    // Two feeds, each read over its own connection, joined outside both brackets
    List<String> twoFeedsLog = new CopyOnWriteArrayList<>();
    VStream<Order> london =
        ordersOver(new LoggedFeedService(twoFeedsLog, new PagedFeed(ORDERS.subList(0, 2))));
    VStream<Order> edinburgh =
        ordersOver(new LoggedFeedService(twoFeedsLog, new PagedFeed(ORDERS.subList(2, 4))));

    long both = london.concat(edinburgh).count().run();
    // 4
    List<String> twoFeedsRun = List.copyOf(twoFeedsLog);
    // [feed opened, page 1, page 2, feed closed, feed opened, page 1, page 2, feed closed]
```

A `use` such as `connection -> orders(connection).concat(next)` instead keeps the first connection open until `next` has been read too.

## `onFinalize`: cleanup for any stream {#onfinalize-lightweight-cleanup}

`onFinalize(task)` runs a task when the stream's run ends, with nothing to open. It suits cleanup such as a log line or a metric:

```java
    List<String> reports = new CopyOnWriteArrayList<>();
    VStream<String> customers =
        orders(new PagedFeed(ORDERS))
            .map(VStreamBook::customer)
            .onFinalize(VTask.exec(() -> reports.add("customers read")))
            .onFinalize(VTask.exec(() -> reports.add("report sent")));

    List<String> firstCustomer = customers.take(1).toList().run();
    // [Ada]
    List<String> afterTake = List.copyOf(reports);
    // [customers read, report sent]
```

- **A finaliser runs once for each run**, when the run completes, fails, or is closed early by an operation that stops.
- **A stream the run never reaches is left as it is.** When a run stops before it reads `concat`'s second stream, `flatMap`'s stream for an element or the stream after `prepend`'s element, that stream's finaliser does not run. To run one regardless, attach it after the `concat` or `prepend`.
- **Several finalisers run in the order they were attached.**
- **After a recovered failure, the finaliser runs when the stream ends.** When a `recover` reads on after a failed `mapTask` task, the run goes on, and the finaliser waits for its end.
- **A failing finaliser is reported as a failing release is**, as [When something fails](#when-something-fails) shows. When several fail, the others still run, the first one's exception is thrown, and each later one is suppressed onto it.

`bracket` is built on `onFinalize`: its release is the finaliser of the stream that `use` gives.

## On a `VStreamPath` {#on-a-vstreampath}

[`VStreamPath`](../effect/path_vstream.md) has both: `Path.vstreamBracket` builds one, and `onFinalize` attaches a finaliser:

```java
    List<String> pathLog = new CopyOnWriteArrayList<>();
    FeedService service = new LoggedFeedService(pathLog);
    VStreamPath<Order> viaPath =
        Path.vstreamBracket(
                VTask.of(service::open), VStreamBook::orders, VStreamResourcesBook::closing)
            .onFinalize(VTask.exec(() -> pathLog.add("orders read")));

    long count = viaPath.count().unsafeRun();
    // 6
    List<String> pathRun = List.copyOf(pathLog);
    // [feed opened, page 1, page 2, page 3, page 4, feed closed, orders read]
```

The connection's release runs before the finaliser attached after it.

## Pulling by hand {#pulling-by-hand}

~~~admonish warning title="Close a stream you pull by hand"
A release runs when its run completes, fails or is closed. Pull steps by hand, as [What a pull gives](vstream.md#what-a-pull-gives) shows, and stop part-way, and the connection stays open until you close the stream you pulled, or the tail you hold. The first pull of `ordersOver` opens the connection and gives a `Skip`, so even one pull leaves something to close. A pull that throws releases what it opened by itself.

`take` closes the rest only on the pull after its last element, so a hand puller who stops at that `Emit` still closes. A `Fail` step, for a failed `mapTask` task, holds the rest of the stream in its tail: close it, or read on from it, as you would an `Emit`'s. Running a pulled `VTask` twice opens two connections, and closing the stream you called `pull()` on closes only the latest run's, so close the tail each run gave you.
~~~

## Which thread releases {#which-thread-releases}

A release, or a finaliser, runs on the thread that makes the stream's last pull or closes it. That is the thread running the terminal operation, unless a parallel operation reads the stream on a thread of its own, as `parEvalMapUnordered` and `merge` do.

If that thread was interrupted before the release starts, the interrupt is held back while the release runs, and set again afterwards, so a release that blocks still finishes. An interrupt that arrives while the release runs, as a timeout's can, still reaches it.

## Methods {#methods}

| Method | What it does |
|---|---|
| `VStream.bracket(acquire, use, release)` | Opens a resource for each run, reads the stream `use` builds, and releases it however the run ends |
| `stream.onFinalize(task)` | Runs `task` once for each run, when the run ends |
| `stream.close()` | Closes the stream: runs the finalisers upstream of it, and releases what its latest run opened |
| `Path.vstreamBracket(acquire, use, release)`, `path.onFinalize(task)` | The same, on a `VStreamPath` |

## When to use bracket and onFinalize {#when-to-use-them}

| You need | Use |
|---|---|
| A resource opened for each run of a stream, and closed after | `bracket` |
| Cleanup with nothing to open, such as a log line or a metric | `onFinalize` |
| Several resources read one after another | Brackets joined with `concat` |
| A resource for one task, not a stream | [Resource](vtask_resource.md) |

~~~admonish info title="Hands-On Learning"
Practise `bracket` and `onFinalize` in Part 1 of [TutorialVStreamAdvanced](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/concurrency/TutorialVStreamAdvanced.java) (exercises 1 to 3).
~~~

---

**Previous:** [Performance](vstream_performance.md)
**Next:** [Advanced Features](vstream_advanced.md)
