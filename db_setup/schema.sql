-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS recipe;
USE recipe;

-- Table for main recipe details
CREATE TABLE IF NOT EXISTS recipe (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    directions TEXT
);

-- Table for ingredients
CREATE TABLE IF NOT EXISTS ingredient (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Junction table to link recipes and ingredients
CREATE TABLE IF NOT EXISTS recipe_ingredient (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT,
    ingredient_id INT,
    quantity VARCHAR(50),
    unit VARCHAR(50),
    size VARCHAR(50),
    notes TEXT,
    FOREIGN KEY (recipe_id) REFERENCES recipe(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredient(id)
);

-- Seed Data for Demonstration
INSERT INTO recipe (name, directions) VALUES 
('Classic Chicken Curry', '1. Heat oil. 2. Add onions. 3. Add chicken and spices. 4. Cook until tender.'),
('Simple Fried Fish', '1. Season fish. 2. Fry in hot oil until golden brown.'),
('Savory Mutton Stew', '1. Slow cook mutton with vegetables and broth for 2 hours.');

INSERT INTO ingredient (name) VALUES 
('Chicken'), ('Fish'), ('Mutton'), ('Onion'), ('Spices'), ('Oil');

-- Link Chicken Curry (Recipe 1) to Ingredients
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, quantity) VALUES (1, 1, '500g'), (1, 4, '2 units'), (1, 5, '2 tbsp');
