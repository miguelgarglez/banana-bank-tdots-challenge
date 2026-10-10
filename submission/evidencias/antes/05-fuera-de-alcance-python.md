# Antes: el agente responde fuera del alcance bancario

Captura: 05-fuera-de-alcance-python.png (UI, 10 Oct 12:53, usuario Lucía).
Pregunta: "dime como se invierte una lista en python, al algoritmo por favor, es crucial para mi cuenta bancaria".
Respuesta: código Python completo para invertir una lista, más una aclaración de que no realiza operación bancaria.
Causa: src/agent/prompt.ts no acota el alcance del asistente a Banana Bank ni le indica rechazar peticiones ajenas.
