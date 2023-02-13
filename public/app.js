const form = document.getElementById("movie-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent the form from submitting normally

  const formData = new FormData(event.target);

  const data = {
    title: formData.get("title"),
    year: formData.get("year") || "2000",
  };
  console.log(data);

  // Perform the fetch request
  fetch("/api/helloworld", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error(error));
});
