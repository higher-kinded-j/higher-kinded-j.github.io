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
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="home.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="part-title">Core Concepts</li><li class="chapter-item expanded "><a href="core-concepts.html"><strong aria-hidden="true">1.</strong> Concepts</a></li><li class="chapter-item expanded "><a href="usage-guide.html"><strong aria-hidden="true">2.</strong> Usage Guide</a></li><li class="chapter-item expanded "><a href="extending-simulation.html"><strong aria-hidden="true">3.</strong> Extending</a></li><li class="chapter-item expanded affix "><li class="part-title">Supported Types</li><li class="chapter-item expanded "><a href="supported-types.html"><strong aria-hidden="true">4.</strong> Overview</a></li><li class="chapter-item expanded "><a href="identity.html"><strong aria-hidden="true">5.</strong> Identity</a></li><li class="chapter-item expanded "><a href="list_monad.html"><strong aria-hidden="true">6.</strong> List</a></li><li class="chapter-item expanded "><a href="optional_monad.html"><strong aria-hidden="true">7.</strong> Optional</a></li><li class="chapter-item expanded "><a href="maybe_monad.html"><strong aria-hidden="true">8.</strong> Maybe</a></li><li class="chapter-item expanded "><a href="either_monad.html"><strong aria-hidden="true">9.</strong> Either</a></li><li class="chapter-item expanded "><a href="try_monad.html"><strong aria-hidden="true">10.</strong> Try</a></li><li class="chapter-item expanded "><a href="cf_monad.html"><strong aria-hidden="true">11.</strong> CompletableFuture</a></li><li class="chapter-item expanded "><a href="io_monad.html"><strong aria-hidden="true">12.</strong> IO</a></li><li class="chapter-item expanded "><a href="lazy_monad.html"><strong aria-hidden="true">13.</strong> Lazy</a></li><li class="chapter-item expanded "><a href="reader_monad.html"><strong aria-hidden="true">14.</strong> Reader</a></li><li class="chapter-item expanded "><a href="state_monad.html"><strong aria-hidden="true">15.</strong> State</a></li><li class="chapter-item expanded "><a href="writer_monad.html"><strong aria-hidden="true">16.</strong> Writer</a></li><li class="chapter-item expanded affix "><li class="part-title">Transformers</li><li class="chapter-item expanded "><a href="transformers.html"><strong aria-hidden="true">17.</strong> Overview</a></li><li class="chapter-item expanded "><a href="eithert_transformer.html"><strong aria-hidden="true">18.</strong> EitherT</a></li><li class="chapter-item expanded "><a href="maybet_transformer.html"><strong aria-hidden="true">19.</strong> MaybeT</a></li><li class="chapter-item expanded "><a href="optionalt_transformer.html"><strong aria-hidden="true">20.</strong> OptionalT</a></li><li class="chapter-item expanded "><a href="readert_transformer.html"><strong aria-hidden="true">21.</strong> ReaderT</a></li><li class="chapter-item expanded "><a href="statet_transformer.html"><strong aria-hidden="true">22.</strong> StateT</a></li><li class="chapter-item expanded affix "><li class="part-title">Examples</li><li class="chapter-item expanded "><a href="order-walkthrough.html"><strong aria-hidden="true">23.</strong> Order Workflow</a></li><li class="chapter-item expanded affix "><li class="part-title">Project Info</li><li class="chapter-item expanded "><a href="CONTRIBUTING.html"><strong aria-hidden="true">24.</strong> Contributing</a></li><li class="chapter-item expanded "><a href="CODE_OF_CONDUCT.html"><strong aria-hidden="true">25.</strong> Code of Conduct</a></li><li class="chapter-item expanded "><a href="LICENSE.html"><strong aria-hidden="true">26.</strong> License</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0];
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
