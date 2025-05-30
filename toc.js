// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item affix "><a href="home.html">Higher-Kinded-J</a></li><li class="chapter-item affix "><li class="part-title">Core Concepts</li><li class="chapter-item "><a href="core-concepts.html"><strong aria-hidden="true">1.</strong> Concepts</a></li><li class="chapter-item "><a href="usage-guide.html"><strong aria-hidden="true">2.</strong> Usage Guide</a></li><li class="chapter-item "><a href="extending-simulation.html"><strong aria-hidden="true">3.</strong> Extending</a></li><li class="chapter-item "><a href="supported-types.html"><strong aria-hidden="true">4.</strong> Monads</a><a class="toggle"><div>❱</div></a></li><li><ol class="section"><li class="chapter-item "><a href="identity.html"><strong aria-hidden="true">4.1.</strong> Identity</a></li><li class="chapter-item "><a href="list_monad.html"><strong aria-hidden="true">4.2.</strong> List</a></li><li class="chapter-item "><a href="optional_monad.html"><strong aria-hidden="true">4.3.</strong> Optional</a></li><li class="chapter-item "><a href="maybe_monad.html"><strong aria-hidden="true">4.4.</strong> Maybe</a></li><li class="chapter-item "><a href="either_monad.html"><strong aria-hidden="true">4.5.</strong> Either</a></li><li class="chapter-item "><a href="try_monad.html"><strong aria-hidden="true">4.6.</strong> Try</a></li><li class="chapter-item "><a href="cf_monad.html"><strong aria-hidden="true">4.7.</strong> CompletableFuture</a></li><li class="chapter-item "><a href="io_monad.html"><strong aria-hidden="true">4.8.</strong> IO</a></li><li class="chapter-item "><a href="lazy_monad.html"><strong aria-hidden="true">4.9.</strong> Lazy</a></li><li class="chapter-item "><a href="reader_monad.html"><strong aria-hidden="true">4.10.</strong> Reader</a></li><li class="chapter-item "><a href="state_monad.html"><strong aria-hidden="true">4.11.</strong> State</a></li><li class="chapter-item "><a href="writer_monad.html"><strong aria-hidden="true">4.12.</strong> Writer</a></li></ol></li><li class="chapter-item "><a href="transformers.html"><strong aria-hidden="true">5.</strong> Transformers</a><a class="toggle"><div>❱</div></a></li><li><ol class="section"><li class="chapter-item "><a href="eithert_transformer.html"><strong aria-hidden="true">5.1.</strong> EitherT</a></li><li class="chapter-item "><a href="maybet_transformer.html"><strong aria-hidden="true">5.2.</strong> MaybeT</a></li><li class="chapter-item "><a href="optionalt_transformer.html"><strong aria-hidden="true">5.3.</strong> OptionalT</a></li><li class="chapter-item "><a href="readert_transformer.html"><strong aria-hidden="true">5.4.</strong> ReaderT</a></li><li class="chapter-item "><a href="statet_transformer.html"><strong aria-hidden="true">5.5.</strong> StateT</a></li></ol></li><li class="chapter-item "><li class="part-title">Examples</li><li class="chapter-item "><a href="order-walkthrough.html"><strong aria-hidden="true">6.</strong> Order Workflow</a></li><li class="chapter-item affix "><li class="part-title">Project Info</li><li class="chapter-item "><a href="CONTRIBUTING.html"><strong aria-hidden="true">7.</strong> Contributing</a></li><li class="chapter-item "><a href="CODE_OF_CONDUCT.html"><strong aria-hidden="true">8.</strong> Code of Conduct</a></li><li class="chapter-item "><a href="LICENSE.html"><strong aria-hidden="true">9.</strong> License</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
