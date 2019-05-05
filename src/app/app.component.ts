import { ApolloQueryResult } from 'apollo-client';
import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { Todos, Todo } from './types';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  flipped = false;
  title = 'Todo App powered by GraphQL';
  todos: Array<Todo> = [];
  loading = true;
  currentFilter = 'SHOW_ALL';

  constructor(private apollo: Apollo) { }

  setFilter(event) {
    this.currentFilter = ['SHOW_ALL', 'SHOW_ACTIVE', 'SHOW_COMPLETED'][event.index];
  }

  ngOnInit() {
    const query = this.apollo.watchQuery({
      query: gql`
        query todos {
          allTodoes {
            id
            complete
            text
          }
        }`
    });

    query.valueChanges
      .subscribe({
        next: (result) => {
          this.loading = result.loading;
          this.todos = (result.data as Todos).allTodoes;
        },
        error: (error) => {
          console.log(`Error: ${error.message}`);
        }
      });

    query
    .subscribeToMore({
      document: gql`
        subscription {
          Todo(filter: {
            mutation_in: [CREATED, UPDATED, DELETED]
          }) {
            mutation
            node {
              id
              text
              complete
            }
            previousValues {
              id
              text
              complete
            }
          }
        }
      `,
      updateQuery: (state: Todos, {subscriptionData}) => {
        // Issue: wanted to use new Store but there's no API for subscriptions yet
        let todos;
        let t;
        const {mutation, node: node} = t = (subscriptionData as any).Todo;

        switch (mutation) {
          case 'CREATED':
          case 'UPDATED':
            let exists = false;
            // UPDATE
            todos = state.allTodoes.map(todo => {
              // covers updates and new todos
              // created by this client
              if (todo.id === node.id) {
                exists = true;
                return {
                  id: node.id,
                  text: node.text,
                  complete: node.complete,
                  __typename: 'Todo'
                };
              }
              return todo;
            });
            // NEWLY CREATED (other clients)
            if (!exists) {
              todos.push({
                id: node.id,
                text: node.text,
                complete: node.complete,
                __typename: 'Todo'
              });
            }
            break;
          case 'DELETED':
            todos = state.allTodoes
              .filter(todo => todo.id !== t.previousValues.id);
            break;
        }

        return {
          allTodoes: todos
        };
      }
    });
  }
}
