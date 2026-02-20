// Initialize AOS
AOS.init();


// Autofill product name
function orderNow(product) {

  document.getElementById("product").value = product;

  document
    .getElementById("order")
    .scrollIntoView({ behavior: "smooth" });

}


// WhatsApp Order Submit
document
  .getElementById("orderForm")
  .addEventListener("submit", function(e) {

    e.preventDefault();

    let name = document.getElementById("name").value;
    let phone = document.getElementById("phone").value;
    let product = document.getElementById("product").value;
    let address = document.getElementById("address").value;

    let message =
`Hello Seemani,

I would like to place an order:

Name: ${name}
Mobile: ${phone}
Product: ${product}
Address: ${address}

Please confirm.`;

    // 🔴 Replace with your WhatsApp number
    let whatsappNumber = "91XXXXXXXXXX";

    let url =
      "https://wa.me/" +
      whatsappNumber +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank");

});
